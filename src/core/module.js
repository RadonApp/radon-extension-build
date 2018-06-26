import Chalk from 'chalk';
import Filesystem from 'fs-extra';
import ForEach from 'lodash/forEach';
import IsNil from 'lodash/isNil';
import IsPlainObject from 'lodash/isPlainObject';
import KeyBy from 'lodash/keyBy';
import Map from 'lodash/map';
import MapValues from 'lodash/mapValues';
import Merge from 'lodash/merge';
import Omit from 'lodash/omit';
import PadEnd from 'lodash/padEnd';
import Path from 'path';
import Pick from 'lodash/pick';
import Reduce from 'lodash/reduce';
import Uniq from 'lodash/uniq';
import Util from 'util';

import Git from './git';
import Json from './json';
import Version from './version';
import Vorpal from './vorpal';
import {readPackageDetails} from './package';
import {runSequential} from './helpers/promise';


const Logger = Vorpal.logger;

const ModuleType = {
    'core': {
        name: 'core'
    },
    'tool': {
        name: 'tool',
        directory: 'Tools/'
    },

    'packages': {
        name: 'package',
        directory: 'Packages/'
    },

    'destinations': {
        name: 'destination',
        directory: 'Destinations/'
    },
    'sources': {
        name: 'source',
        directory: 'Sources/'
    }
};

function getModulePath(basePath, name, type) {
    let path;

    // Find development module type directory
    path = Path.resolve(basePath, (type.directory || '') + name);

    if(Filesystem.existsSync(path)) {
        return path;
    }

    // Find browser package
    if(type.name === 'package' && Filesystem.existsSync(basePath, 'extension.json')) {
        return Path.resolve(basePath);
    }

    // Find installed module
    path = Path.resolve(basePath, 'node_modules', name);

    if(Filesystem.existsSync(path)) {
        return path;
    }

    throw new Error(`Unable to find "${name}" module`);
}

function readContributors(path) {
    // Read contributors from file
    return Filesystem.readJson(Path.join(path, 'contributors.json')).then((data) => {
        if(!Array.isArray(data)) {
            return Promise.reject(new Error(
                'Expected contributors to be an array'
            ));
        }

        return data;
    }, () => ([]));
}

function getContentScriptOrigins(contentScripts) {
    return Reduce(contentScripts, (result, contentScript) => {
        ForEach(contentScript.matches, (origin) => {
            if(IsNil(origin)) {
                throw new Error(`Invalid content script origin: ${origin}`);
            }

            // Include origin in result
            result.push(origin);
        });

        return result;
    }, []);
}

function parseModuleManifest(extension, data) {
    let manifest = Merge({
        'title': data.name || null,
        'icons': {},

        'content_scripts': [],
        'web_accessible_resources': [],

        'origins': [],
        'permissions': [],

        'optional_origins': [],
        'optional_permissions': [],

        'webpack': {
            'alias': [],
            'babel': [],
            'modules': {}
        }
    }, data);

    // Include content script origins
    if(extension.features.contentScripts === 'dynamic') {
        manifest['origins'] = manifest['origins'].concat(getContentScriptOrigins(manifest['content_scripts']));
    }

    // Remove duplicate origins
    manifest.origins = Uniq(manifest.origins);

    // Remove duplicate permissions
    manifest.permissions = Uniq(manifest.permissions);

    // Parse webpack modules
    manifest.webpack.modules = MapValues(manifest.webpack.modules, (value, name) => {
        let options = {};

        if(Array.isArray(value)) {
            options = { modules: value };
        } else if(IsPlainObject(value)) {
            options = value;
        }

        return {
            entry: false,
            modules: [name],

            ...options
        };
    });

    return manifest;
}

function readModuleManifest(path, browser = null) {
    let name = 'module.json';

    if(!IsNil(browser)) {
        name = `module.${browser}.json`;
    }

    // Read manifest from file
    return Json.read(Path.join(path, name), {}).then((manifest) => {
        if(!IsPlainObject(manifest)) {
            return Promise.reject(new Error(
                'Expected manifest to be a plain object'
            ));
        }

        return manifest;
    }, () => (
        {}
    ));
}

function getModuleManifest(extension, module) {
    return readModuleManifest(module.path).then(
        (manifest) => parseModuleManifest(extension, manifest),
        () => parseModuleManifest(extension, {})
    );
}

function overlayModuleManifest(module, browser) {
    return readModuleManifest(module.path, browser).then((manifest) => ({
        ...module.manifest,
        ...manifest
    }));
}

export function resolve(browser, extension, path, type, name) {
    let moduleType = ModuleType[type];

    if(IsNil(moduleType)) {
        return Promise.reject(new Error(
            `Unknown module type: "${type}"`
        ));
    }

    // Build module key
    let key = name.substring(name.lastIndexOf('-') + 1);

    if(key.length < 1) {
        return Promise.reject(new Error(
            `Invalid module name: "${name}"`
        ));
    }

    // Build module
    let module = {
        key,
        type: moduleType.name,
        path: getModulePath(path, name, moduleType)
    };

    // Resolve module metadata
    return Promise.resolve(module)
        .then((module) => readPackageDetails(module.path).then((pkg) => ({
            ...module,

            // Extension
            ...Omit(pkg, [
                'repository'
            ]),

            // Package
            package: pkg
        })))
        // Resolve repository status
        .then((module) => Promise.resolve().then(() => {
            if(module.type === 'package') {
                return extension.repository;
            }

            // Return repository status from the build manifest
            if(!IsNil(extension.build[module.name])) {
                if(!IsNil(extension.build[module.name].repository)) {
                    return extension.build[module.name].repository;
                }

                Logger.warn(Chalk.yellow(
                    `[${PadEnd(module.name, 40)}] No repository status available in the build manifest`
                ));
            }

            // Find repository
            let path = Path.join(extension.path, '.modules', module.name);

            if(!Filesystem.existsSync(path)) {
                path = module.path;
            }

            // Resolve repository status
            return Git.status(path).catch(() => ({
                ahead: 0,
                dirty: false,

                branch: null,
                commit: null,

                tag: null,
                latestTag: null
            }));
        }).then((repository) => {
            Logger.debug(`[${PadEnd(name, 40)}] Repository: ${Util.inspect(repository)}`);

            if(IsNil(repository.commit) && !repository.dirty) {
                Logger.error(Chalk.red(`[${PadEnd(module.name, 40)}] Invalid repository status (no commit defined)`));
                return Promise.reject();
            }

            return {
                ...module,

                // Module
                ...Pick(repository, [
                    'branch',
                    'commit',

                    'tag',
                    'latestTag'
                ]),

                // Repository
                repository
            };
        }))
        // Resolve travis status (for package modules)
        .then((module) => {
            if(module.type !== 'package') {
                return module;
            }

            return {
                ...module,

                // Module
                ...Pick(extension.travis, [
                    'branch',
                    'commit',
                    'tag'
                ]),

                // Travis
                travis: extension.travis
            };
        })
        // Resolve contributors
        .then((module) => readContributors(module.path).then((contributors) => ({
            ...module,

            contributors
        })))
        // Resolve module manifest
        .then((module) => getModuleManifest(extension, module).then((manifest) => ({
            ...module,
            ...manifest,

            manifest: manifest
        })))
        // Resolve version
        .then((module) => ({
            ...module,
            ...Version.resolve(module)
        }))
        // Resolve module manifest overlay
        .then((module) => overlayModuleManifest(module, browser.name).then((manifest) => ({
            ...module,
            ...manifest,

            // Manifest
            manifest
        })));
}

export function resolveMany(path, browser, extension) {
    // Resolve each module sequentially
    return runSequential(Reduce(extension.modules, (modules, names, type) => {
        modules.push(...Map(names, (name) => {
            return { type, name };
        }));

        return modules;
    }, [
        { type: 'tool', name: 'neon-extension-build' }
    ]), ({ type, name }) =>
        resolve(browser, extension, path, type, name)
    ).then((modules) => {
        return KeyBy(modules, 'name');
    });
}

export default {
    resolve,
    resolveMany
};
