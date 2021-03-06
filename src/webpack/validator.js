import Filesystem from 'fs-extra';
import Filter from 'lodash/filter';
import Find from 'lodash/find';
import ForEach from 'lodash/forEach';
import Get from 'lodash/get';
import IsNil from 'lodash/isNil';
import Path from 'path';
import Set from 'lodash/set';

import ValidatorPlugin from './plugins/validator';
import Vorpal from '../core/vorpal';


const Logger = Vorpal.logger;
const DependencyVersionRegex = /^\d+\.\d+\.\d+(\-\w+(\.\d+)?)?$/g;

const IgnoredPackages = [
    'jquery',
    'react',
    'react-dom',
    'webpack'
];

export default class Validator {
    static links = {};

    constructor() {
        this.checked = {};
        this.dependencies = {};

        this._error = false;
    }

    validate(browser, environment, module) {
        if(IsNil(browser) || IsNil(environment) || IsNil(module) || IsNil(module.userRequest)) {
            return;
        }

        // Validate module reasons
        ForEach(this.resolveReasons(browser, environment, module), ({ module, source }) => {
            if(Get(this.checked, [module.userRequest, source])) {
                return;
            }

            // Mark as checked
            Set(this.checked, [module.userRequest, source], true);

            // Validate module reason
            this.validateReason(browser, environment, source, module.userRequest);
        });
    }

    validateReason(browser, environment, source, request) {
        if(IsNil(browser) || IsNil(environment) || IsNil(request)) {
            return false;
        }

        // Retrieve dependency name
        let dep;

        try {
            dep = Validator.parseDependency(request);
        } catch(e) {
            Logger.warn(`Unable to parse dependency: "${request}": ${e}`);
            return false;
        }

        // Validate package information
        if(IsNil(dep)) {
            Logger.warn(`Unable to parse dependency: "${request}"`);
            return false;
        }

        // Apply `IgnoredPackages` filter
        if(IgnoredPackages.indexOf(dep.name) >= 0) {
            return false;
        }

        // Find registered module matching source (if available)
        let module;

        if(!IsNil(source)) {
            module = Find(browser.modules, (module) => {
                return source.startsWith(module.path);
            });

            if(IsNil(module)) {
                Logger.error(`[${dep.name}] Unknown source: "${source}"`);

                this._error = true;
                return false;
            }
        }

        // Ignore internal dependencies
        if(!IsNil(module) && dep.name === module.name) {
            return true;
        }

        // Apply module dependency rules
        if(dep.name.startsWith('@radon-extension/') && !this._isModulePermitted(module, dep.name)) {
            Logger.error(`Dependency "${dep.name}" is not permitted for "${module.name}" (request: "${request}")`);

            this._error = true;
            return false;
        }

        // Find module dependency
        let moduleDependency;

        if(!IsNil(module) && module.type !== 'package') {
            let { dependency, valid } = this.validateDependency(dep, module);

            if(!valid) {
                this._error = true;
                return false;
            }

            // Store result
            moduleDependency = dependency;
        } else {
            Logger.error(`Dependency "${dep.name}" should be defined`, source);

            this._error = true;
            return false;
        }

        // Mark module dependency
        if(!IsNil(moduleDependency)) {
            Set(this.dependencies, [browser.name, environment.name, module.name, dep.name], true);
        }

        return true;
    }

    validateDependency(dep, module) {
        if(dep.name.indexOf('@radon-extension/') === 0) {
            return this.validateModule(dep, module);
        }

        return this.validateRequirement(dep, module);
    }

    validateRequirement(dep, module) {
        let moduleDependency = module.package.dependencies[dep.name];

        // Ensure dependency exists
        if(IsNil(moduleDependency)) {
            Logger.error(`Dependency "${dep.name}" should be defined for "${module.name}"`);

            return {
                dependency: moduleDependency,
                valid: false
            };
        }

        // Ensure development dependency isn't defined
        if(!IsNil(module.package.devDependencies[dep.name])) {
            Logger.error(
                `Dependency "${dep.name}" for "${module.name}" shouldn't be defined as ` +
                'a development dependency'
            );

            return {
                dependency: moduleDependency,
                valid: false
            };
        }

        // Ensure peer dependency isn't defined
        if(!IsNil(module.package.peerDependencies[dep.name])) {
            Logger.error(
                `Dependency "${dep.name}" for "${module.name}" shouldn't be defined as ` +
                'a peer dependency'
            );

            return {
                dependency: moduleDependency,
                valid: false
            };
        }

        // Ensure dependency isn't pinned to a version
        if(moduleDependency.match(DependencyVersionRegex)) {
            Logger.error(
                `Dependency "${dep.name}" for "${module.name}" ` +
                `shouldn\'t be pinned to a version (found: ${moduleDependency})`
            );

            this._error = true;
            return false;
        }

        return {
            dependency: moduleDependency,
            valid: true
        };
    }

    validateModule(dep, module) {
        let moduleDependency = module.package.peerDependencies[dep.name];

        // Ensure dependency exists
        if(IsNil(moduleDependency)) {
            Logger.error(`Dependency "${dep.name}" should be defined for "${module.name}"`);

            return {
                dependency: moduleDependency,
                valid: false
            };
        }

        // Ensure development dependency isn't defined
        if(!IsNil(module.package.devDependencies[dep.name])) {
            Logger.error(
                `Dependency "${dep.name}" for "${module.name}" shouldn't be defined as ` +
                'a development dependency'
            );

            return {
                dependency: moduleDependency,
                valid: false
            };
        }

        // Ensure dependency isn't pinned to a version
        if(moduleDependency.match(DependencyVersionRegex)) {
            Logger.error(
                `Dependency "${dep.name}" for "${module.name}" ` +
                `shouldn\'t be pinned to a version (found: ${moduleDependency})`
            );

            this._error = true;
            return false;
        }

        return {
            dependency: moduleDependency,
            valid: true
        };
    }

    resolveModule(browser, path, options) {
        options = {
            dependencies: true,

            ...(options || {})
        };

        return Find(browser.modules, (module) => {
            if(module.type === 'package' || path.indexOf(module.path) < 0) {
                return false;
            }

            if(!options.dependencies && path.indexOf(Path.join(module.path, 'node_modules')) > -1) {
                return false;
            }

            return true;
        });
    }

    resolveReasons(browser, environment, module) {
        let reasons = [];

        ForEach(module.reasons, (reason) => {
            if(IsNil(reason.module) || IsNil(reason.module.userRequest)) {
                return;
            }

            let source = Validator.resolveLink(browser, environment, reason.module.userRequest);

            // Resolve module
            if(!IsNil(this.resolveModule(browser, source, { dependencies: false }))) {
                reasons.push({ module, source });
                return;
            }

            // Resolve reasons
            reasons.push(...this.resolveReasons(browser, environment, reason.module));
        });

        return reasons;
    }

    finish(browser, environment) {
        if(this._error) {
            throw new Error('Build didn\'t pass validation');
        }

        if(IsNil(this.dependencies[browser.name]) || IsNil(this.dependencies[browser.name][environment.name])) {
            throw new Error('No dependencies validated');
        }

        Logger.info(`Checked ${Object.keys(this.checked).length} module(s)`);

        // Ensure there are no unused extension dependencies
        this._checkDependencies('Dependency',
            browser.extension.package.dependencies,
            this.dependencies[browser.name][environment.name][null]
        );

        // Ensure there are no unused module dependencies
        ForEach(Filter(browser.modules, (module) => ['package', 'tool'].indexOf(module.type) < 0), (module) => {
            this._checkDependencies('Dependency',
                module.package.dependencies,
                this.dependencies[browser.name][environment.name][module.name],
                module.name
            );
        });
    }

    _checkDependencies(prefix, current, matched, moduleName) {
        if(IsNil(prefix) || IsNil(current)) {
            return;
        }

        matched = matched || {};

        // Ensure dependencies have been matched
        for(let name in current) {
            if(!current.hasOwnProperty(name) || name.startsWith('@radon-extension/')) {
                continue;
            }

            // Check if module was used
            if(matched[name]) {
                continue;
            }

            // Display warning
            if(!IsNil(moduleName)) {
                Logger.warn(`${prefix} "${name}" for "${moduleName}" is not required`);
            } else {
                Logger.warn(`${prefix} "${name}" is not required`);
            }
        }
    }

    _isModulePermitted(module, name) {
        if(IsNil(module)) {
            return true;
        }

        return name === '@radon-extension/framework';
    }

    static createPlugin(browser, environment) {
        return new ValidatorPlugin(new Validator(), browser, environment);
    }

    static registerLink(browser, environment, source, target) {
        let dep;

        // Retrieve dependency name
        try {
            dep = Validator.parseDependency(source);
        } catch(e) {
            Logger.warn(`Unable to parse dependency: "${source}": ${e}`);
            return;
        }

        // Ignore modules
        if(dep.name.indexOf('@radon-extension/') === 0) {
            return;
        }

        // Prefer browser package sources
        let current = Get(Validator.links, [browser.name, environment.name, target]);

        if(!IsNil(current)) {
            let module = Path.basename(current.substring(0, current.lastIndexOf('node_modules') - 1));

            if(browser.package === module) {
                return;
            }
        }

        // Register link
        Set(Validator.links, [browser.name, environment.name, target], source);

        Logger.info(`Registered link: "${source}" -> "${target}"`);
    }

    static resolveLink(browser, environment, path) {
        if(IsNil(path)) {
            return path;
        }

        // Map linked dependency source
        ForEach(Get(Validator.links, [browser.name, environment.name]), (source, target) => {
            let index = path.indexOf(target);

            if(index < 0) {
                return true;
            }

            // Update `path`
            path = source + path.substring(index + target.length);
            return false;
        });

        return path;
    }

    static getDependencyName(path) {
        path = Path.normalize(path);

        let pos;

        // Find module directory
        pos = path.lastIndexOf('node_modules');

        // No module directory found
        if(pos < 0) {
            return null;
        }

        let name = path.substring(pos + 13);

        // Remove trailing path
        pos = name.indexOf(Path.sep);

        if(pos < 0) {
            return name;
        }

        // Scoped package
        if(name.indexOf('@') === 0) {
            pos = name.indexOf(Path.sep, pos + 1);

            if(pos < 0) {
                return name;
            }
        }

        // Return dependency name
        return name.substring(0, pos).replace(/\\/g, '/');
    }

    static parseDependency(request) {
        if(!Filesystem.existsSync(request)) {
            request = request.substring(0, request.indexOf('/')) || request;

            return {
                name: request,
                path: null
            };
        }

        let path = request;

        // Resolve directory
        if(Filesystem.statSync(path).isFile()) {
            path = Path.dirname(path);
        }

        // Resolve package path
        let packagePath;

        while(true) {
            let current = Path.join(path, 'package.json');

            if(Filesystem.pathExistsSync(current)) {
                packagePath = current;
                break;
            }

            // Go up one directory
            let next = Path.resolve(path, '..');

            if(next === path) {
                return null;
            }

            // Set next search directory
            path = next;
        }

        // Retrieve package name
        let packageName = Filesystem.readJsonSync(packagePath)['name'];

        // Validate package name matches path
        let name = Validator.getDependencyName(packagePath);

        if(!IsNil(name) && name !== packageName) {
            Logger.warn(`Package "${packageName}" doesn't match path "${name}"`);
        }

        // Return package information
        return {
            name: packageName,
            path
        };
    }
}
