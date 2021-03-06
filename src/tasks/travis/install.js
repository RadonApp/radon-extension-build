import Chalk from 'chalk';
import Filesystem from 'fs-extra';
import IsNil from 'lodash/isNil';
import Merge from 'lodash/merge';
import Mkdirp from 'mkdirp';
import Path from 'path';
import Process from 'process';
import SemanticVersion from 'semver';

import Git from '../../core/git';
import Github from '../../core/github';
import Link from '../../core/link';
import Npm from '../../core/npm';
import Vorpal from '../../core/vorpal';
import {isBrowser} from '../../core/browser';
import {getPackageModules, writePackage, writePackageLocks} from '../../core/package';
import {resolveOne, runSequential} from '../../core/helpers/promise';


export function getBranches(ref) {
    if(['master', 'develop'].indexOf(ref) >= 0) {
        return [ref];
    }

    // Release
    if(SemanticVersion.valid(ref)) {
        return [ref, `v${SemanticVersion.major(ref)}.${SemanticVersion.minor(ref)}`];
    }

    // Feature
    return [ref, 'develop'];
}

export function clone(target, branch, name) {
    if(name.indexOf('radon-extension-') !== 0) {
        return Promise.reject(new Error(`Invalid repository name: ${name}`));
    }

    // Build modules path
    let modulesPath = Path.join(target, '.modules');

    // Build local module path
    let localPath = Path.join(modulesPath, name);

    if(Filesystem.existsSync(localPath)) {
        return Promise.resolve({
            branch,
            localPath
        });
    }

    // Install module
    return resolveOne(getBranches(branch), (branch) => Github.exists(name, branch).then(() => {
        Vorpal.logger.info(
            `[RadonApp/${name}#${branch}] Cloning to "${Path.relative(Process.cwd(), localPath)}...`
        );

        // Clone repository
        return Git.clone(modulesPath, `https://github.com/RadonApp/${name}.git`, localPath, [
            '-b', branch
        ]).then(() => ({
            branch,
            localPath
        }));
    }));
}

function link(target, branch, module) {
    if(module.indexOf('@radon-extension/') !== 0) {
        return Promise.reject(new Error(`Invalid module name: ${module}`));
    }

    // Build repository name
    let repository = module.replace('@radon-extension/', 'radon-extension-');

    // Clone repository for module
    return clone(target, branch, repository).then(({branch, localPath}) => {
        Vorpal.logger.info(`[RadonApp/${repository}#${branch}] Installing dependencies...`);

        // Install dependencies
        return Npm.install(localPath).then(
            Npm.createHandler(Vorpal.logger, `[RadonApp/${repository}#${branch}]`)
        ).then(() => {
            let linkPath = `${target}/node_modules/${module}`;

            Vorpal.logger.info(`[RadonApp/${repository}#${branch}] "${linkPath}" -> "${localPath}"`);

            // Create link
            return Link.create(linkPath, localPath, [
                `${target}/.modules/`,
                `${target}/node_modules/`
            ]);
        });
    }).catch((err) => {
        Vorpal.logger.warn(`[RadonApp/${repository}#${branch}] Error raised: ${err.message || err}`);
        return Promise.reject(err);
    });
}

function linkModuleDependencies(target, branch, modules) {
    return runSequential(modules, (module) => {
        if(module.indexOf('@radon-extension/') !== 0) {
            return Promise.reject(new Error(`Invalid module name: ${module}`));
        }

        // Build repository name
        let moduleRepository = module.replace('@radon-extension/', 'radon-extension-');

        // Build module path
        let modulePath = Path.join(target, '.modules', moduleRepository);

        // Ensure module exists
        if(!Filesystem.existsSync(modulePath)) {
            return Promise.reject(new Error(`Unable to find module: ${moduleRepository}`));
        }

        Vorpal.logger.info(`[RadonApp/${moduleRepository}#${branch}] Linking module dependencies...`);

        // Read "package.json" file
        return Filesystem.readJson(Path.join(modulePath, 'package.json')).then((pkg) => {
            if(IsNil(pkg) || IsNil(pkg.peerDependencies)) {
                return Promise.resolve();
            }

            return runSequential(Object.keys(pkg.peerDependencies), (name) => {
                if(name.indexOf('@radon-extension/') !== 0) {
                    return Promise.resolve();
                }

                // Build repository name
                let repository = name.replace('@radon-extension/', 'radon-extension-');

                // Build dependency path
                let path = Path.join(target, '.modules', repository);

                // Ensure module exists
                if(!Filesystem.existsSync(path)) {
                    return Promise.reject(new Error(`Unable to find module: ${repository}`));
                }

                let linkPath = Path.join(modulePath, 'node_modules', name);

                Vorpal.logger.info(`[RadonApp/${moduleRepository}#${branch}] "${linkPath}" -> "${path}"`);

                // Create link to module
                return Link.create(linkPath, path, [
                    `${modulePath}/node_modules/`,
                    `${target}/.modules/`
                ]);
            });
        }).catch((err) => {
            Vorpal.logger.warn(`[RadonApp/${moduleRepository}#${branch}] Error raised: ${err.message || err}`);
            return Promise.reject(err);
        });
    });
}

function pack(target, branch, module) {
    if(module.indexOf('@radon-extension/') !== 0) {
        return Promise.reject(new Error(`Invalid module name: ${module}`));
    }

    // Build repository name
    let repository = module.replace('@radon-extension/', 'radon-extension-');

    // Clone repository for module
    return clone(target, branch, repository).then(({branch, localPath}) => {
        Vorpal.logger.info(`[RadonApp/${repository}#${branch}] Installing dependencies...`);

        // Install dependencies
        return Npm.install(localPath).then(
            Npm.createHandler(Vorpal.logger, `[RadonApp/${repository}#${branch}]`)
        ).then(() => {
            // Clean repository
            return Git.clean(localPath).then((status) => {
                if(!status) {
                    Vorpal.logger.warn(Chalk.yellow(`[RadonApp/${repository}#${branch}] Invalid repository status`));
                }

                if(status.files.length > 0) {
                    Vorpal.logger.warn(Chalk.yellow(`[RadonApp/${repository}#${branch}] Repository is dirty`));

                    // List files
                    for(let i = 0; i < status.files.length; i++) {
                        Vorpal.logger.warn(Chalk.yellow(
                            `[RadonApp/${repository}#${branch}] - ${status.files[i].path}`
                        ));
                    }
                }
            }, (err) => {
                Vorpal.logger.warn(Chalk.yellow(
                    `[RadonApp/${repository}#${branch}] Unable to retrieve repository status`, err
                ));
            });
        }).then(() => {
            Vorpal.logger.info(`[RadonApp/${repository}#${branch}] Packing module...`);

            // Pack module
            return Npm.pack(target, localPath).then(({stdout, stderr}) => {
                let lines = stdout.split('\n');

                let file = lines[lines.length - 1];

                if(file.indexOf('radon-extension-') !== 0) {
                    return Promise.reject(new Error(
                        `Invalid file: ${file}`
                    ));
                }

                Npm.writeLines(Vorpal.logger, stderr, {
                    defaultColour: 'cyan',
                    prefix: `[RadonApp/${repository}#${branch}]`
                });

                Vorpal.logger.info(Chalk.green(`[RadonApp/${repository}#${branch}] ${file}`));

                return file;
            }).then((file) => ({
                [module]: `file:${file}`
            }));
        });
    }).catch((err) => {
        Vorpal.logger.warn(`[RadonApp/${repository}#${branch}] Error raised: ${err.message || err}`);
        return Promise.reject(err);
    });
}

function installBrowser(target, branch, modules) {
    // Pack modules
    return runSequential(modules, (name) =>
        pack(target, branch, name)
    ).then((results) => {
        let versions = Merge({}, ...results);

        Vorpal.logger.info(`Updating ${Object.keys(versions).length} package version(s)...`);

        // Update package versions
        return Promise.resolve()
            .then(() => writePackage(target, versions))
            .then(() => writePackageLocks(target, versions));
    }).then(() => {
        Vorpal.logger.info('Linking module dependencies...');

        // Link module dependencies
        return linkModuleDependencies(target, branch, modules);
    }).then(() => {
        Vorpal.logger.info('Installing package...');

        // Install package
        return Npm.install(target).then(
            Npm.createHandler(Vorpal.logger)
        );
    });
}

function installModule(target, branch, modules) {
    Vorpal.logger.info('Installing dependencies...');

    // Install dependencies
    return Npm.install(target).then(
        Npm.createHandler(Vorpal.logger)
    ).then(() => {
        Vorpal.logger.info('Linking modules...');

        // Link modules
        return runSequential(modules, (name) =>
            link(target, branch, name)
        );
    }).then(() => {
        Vorpal.logger.info('Linking module dependencies...');

        // Link module dependencies
        return linkModuleDependencies(target, branch, modules);
    });
}

function install(target, branch, options) {
    options = {
        reuse: false,

        ...(options || {})
    };

    // Build modules path
    let modulesPath = Path.join(target, '.modules');

    // Remove modules directory (if not reusing modules, and one exists)
    if(!options.reuse && Filesystem.existsSync(modulesPath)) {
        Vorpal.logger.info('Removing existing modules...');

        Filesystem.removeSync(modulesPath);
    }

    // Ensure directory exists
    Mkdirp.sync(modulesPath);

    // Read package details
    return Filesystem.readJson(Path.join(target, 'package.json')).then((pkg) => {
        let modules = getPackageModules(pkg);

        Vorpal.logger.info(
            `Installing ${modules.length} module(s) to "${Path.relative(Process.cwd(), target) || `.${Path.sep}`}"...`
        );

        // Browser
        if(isBrowser(pkg['name'])) {
            return installBrowser(target, branch, modules);
        }

        // Module
        return installModule(target, branch, modules);
    }).then(() => {
        Vorpal.logger.info('Cleaning package...');

        // Clean "package-lock.json" (remove "integrity" field from modules)
        return writePackageLocks(target);
    });
}

// Command
let cmd = Vorpal.command('travis:install <branch>', 'Install travis environment.')
    .option('--reuse', 'Re-use existing modules')
    .option('--target <target>', 'Target package [default: ./]');

// Action
cmd.action(({branch, options}) => {
    let target = Path.resolve(options.target || Process.cwd());

    // Run task
    return install(target, branch, options).catch((err) => {
        Vorpal.logger.error(err.stack || err.message || err);
        Process.exit(1);
    });
});
