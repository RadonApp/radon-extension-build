"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getBranches = getBranches;
exports.clone = clone;

var _chalk = _interopRequireDefault(require("chalk"));

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _isNil = _interopRequireDefault(require("lodash/isNil"));

var _merge = _interopRequireDefault(require("lodash/merge"));

var _mkdirp = _interopRequireDefault(require("mkdirp"));

var _path = _interopRequireDefault(require("path"));

var _process = _interopRequireDefault(require("process"));

var _semver = _interopRequireDefault(require("semver"));

var _git = _interopRequireDefault(require("../../core/git"));

var _github = _interopRequireDefault(require("../../core/github"));

var _link = _interopRequireDefault(require("../../core/link"));

var _npm = _interopRequireDefault(require("../../core/npm"));

var _vorpal = _interopRequireDefault(require("../../core/vorpal"));

var _browser = require("../../core/browser");

var _package = require("../../core/package");

var _promise = require("../../core/helpers/promise");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function getBranches(ref) {
  if (['master', 'develop'].indexOf(ref) >= 0) {
    return [ref];
  } // Release


  if (_semver["default"].valid(ref)) {
    return [ref, "v".concat(_semver["default"].major(ref), ".").concat(_semver["default"].minor(ref))];
  } // Feature


  return [ref, 'develop'];
}

function clone(target, branch, name) {
  if (name.indexOf('radon-extension-') !== 0) {
    return Promise.reject(new Error("Invalid repository name: ".concat(name)));
  } // Build modules path


  var modulesPath = _path["default"].join(target, '.modules'); // Build local module path


  var localPath = _path["default"].join(modulesPath, name);

  if (_fsExtra["default"].existsSync(localPath)) {
    return Promise.resolve({
      branch: branch,
      localPath: localPath
    });
  } // Install module


  return (0, _promise.resolveOne)(getBranches(branch), function (branch) {
    return _github["default"].exists(name, branch).then(function () {
      _vorpal["default"].logger.info("[RadonApp/".concat(name, "#").concat(branch, "] Cloning to \"").concat(_path["default"].relative(_process["default"].cwd(), localPath), "...")); // Clone repository


      return _git["default"].clone(modulesPath, "https://github.com/RadonApp/".concat(name, ".git"), localPath, ['-b', branch]).then(function () {
        return {
          branch: branch,
          localPath: localPath
        };
      });
    });
  });
}

function link(target, branch, module) {
  if (module.indexOf('@radon-extension/') !== 0) {
    return Promise.reject(new Error("Invalid module name: ".concat(module)));
  } // Build repository name


  var repository = module.replace('@radon-extension/', 'radon-extension-'); // Clone repository for module

  return clone(target, branch, repository).then(function (_ref) {
    var branch = _ref.branch,
        localPath = _ref.localPath;

    _vorpal["default"].logger.info("[RadonApp/".concat(repository, "#").concat(branch, "] Installing dependencies...")); // Install dependencies


    return _npm["default"].install(localPath).then(_npm["default"].createHandler(_vorpal["default"].logger, "[RadonApp/".concat(repository, "#").concat(branch, "]"))).then(function () {
      var linkPath = "".concat(target, "/node_modules/").concat(module);

      _vorpal["default"].logger.info("[RadonApp/".concat(repository, "#").concat(branch, "] \"").concat(linkPath, "\" -> \"").concat(localPath, "\"")); // Create link


      return _link["default"].create(linkPath, localPath, ["".concat(target, "/.modules/"), "".concat(target, "/node_modules/")]);
    });
  })["catch"](function (err) {
    _vorpal["default"].logger.warn("[RadonApp/".concat(repository, "#").concat(branch, "] Error raised: ").concat(err.message || err));

    return Promise.reject(err);
  });
}

function linkModuleDependencies(target, branch, modules) {
  return (0, _promise.runSequential)(modules, function (module) {
    if (module.indexOf('@radon-extension/') !== 0) {
      return Promise.reject(new Error("Invalid module name: ".concat(module)));
    } // Build repository name


    var moduleRepository = module.replace('@radon-extension/', 'radon-extension-'); // Build module path

    var modulePath = _path["default"].join(target, '.modules', moduleRepository); // Ensure module exists


    if (!_fsExtra["default"].existsSync(modulePath)) {
      return Promise.reject(new Error("Unable to find module: ".concat(moduleRepository)));
    }

    _vorpal["default"].logger.info("[RadonApp/".concat(moduleRepository, "#").concat(branch, "] Linking module dependencies...")); // Read "package.json" file


    return _fsExtra["default"].readJson(_path["default"].join(modulePath, 'package.json')).then(function (pkg) {
      if ((0, _isNil["default"])(pkg) || (0, _isNil["default"])(pkg.peerDependencies)) {
        return Promise.resolve();
      }

      return (0, _promise.runSequential)(Object.keys(pkg.peerDependencies), function (name) {
        if (name.indexOf('@radon-extension/') !== 0) {
          return Promise.resolve();
        } // Build repository name


        var repository = name.replace('@radon-extension/', 'radon-extension-'); // Build dependency path

        var path = _path["default"].join(target, '.modules', repository); // Ensure module exists


        if (!_fsExtra["default"].existsSync(path)) {
          return Promise.reject(new Error("Unable to find module: ".concat(repository)));
        }

        var linkPath = _path["default"].join(modulePath, 'node_modules', name);

        _vorpal["default"].logger.info("[RadonApp/".concat(moduleRepository, "#").concat(branch, "] \"").concat(linkPath, "\" -> \"").concat(path, "\"")); // Create link to module


        return _link["default"].create(linkPath, path, ["".concat(modulePath, "/node_modules/"), "".concat(target, "/.modules/")]);
      });
    })["catch"](function (err) {
      _vorpal["default"].logger.warn("[RadonApp/".concat(moduleRepository, "#").concat(branch, "] Error raised: ").concat(err.message || err));

      return Promise.reject(err);
    });
  });
}

function pack(target, branch, module) {
  if (module.indexOf('@radon-extension/') !== 0) {
    return Promise.reject(new Error("Invalid module name: ".concat(module)));
  } // Build repository name


  var repository = module.replace('@radon-extension/', 'radon-extension-'); // Clone repository for module

  return clone(target, branch, repository).then(function (_ref2) {
    var branch = _ref2.branch,
        localPath = _ref2.localPath;

    _vorpal["default"].logger.info("[RadonApp/".concat(repository, "#").concat(branch, "] Installing dependencies...")); // Install dependencies


    return _npm["default"].install(localPath).then(_npm["default"].createHandler(_vorpal["default"].logger, "[RadonApp/".concat(repository, "#").concat(branch, "]"))).then(function () {
      // Clean repository
      return _git["default"].clean(localPath).then(function (status) {
        if (!status) {
          _vorpal["default"].logger.warn(_chalk["default"].yellow("[RadonApp/".concat(repository, "#").concat(branch, "] Invalid repository status")));
        }

        if (status.files.length > 0) {
          _vorpal["default"].logger.warn(_chalk["default"].yellow("[RadonApp/".concat(repository, "#").concat(branch, "] Repository is dirty"))); // List files


          for (var i = 0; i < status.files.length; i++) {
            _vorpal["default"].logger.warn(_chalk["default"].yellow("[RadonApp/".concat(repository, "#").concat(branch, "] - ").concat(status.files[i].path)));
          }
        }
      }, function (err) {
        _vorpal["default"].logger.warn(_chalk["default"].yellow("[RadonApp/".concat(repository, "#").concat(branch, "] Unable to retrieve repository status"), err));
      });
    }).then(function () {
      _vorpal["default"].logger.info("[RadonApp/".concat(repository, "#").concat(branch, "] Packing module...")); // Pack module


      return _npm["default"].pack(target, localPath).then(function (_ref3) {
        var stdout = _ref3.stdout,
            stderr = _ref3.stderr;
        var lines = stdout.split('\n');
        var file = lines[lines.length - 1];

        if (file.indexOf('radon-extension-') !== 0) {
          return Promise.reject(new Error("Invalid file: ".concat(file)));
        }

        _npm["default"].writeLines(_vorpal["default"].logger, stderr, {
          defaultColour: 'cyan',
          prefix: "[RadonApp/".concat(repository, "#").concat(branch, "]")
        });

        _vorpal["default"].logger.info(_chalk["default"].green("[RadonApp/".concat(repository, "#").concat(branch, "] ").concat(file)));

        return file;
      }).then(function (file) {
        return _defineProperty({}, module, "file:".concat(file));
      });
    });
  })["catch"](function (err) {
    _vorpal["default"].logger.warn("[RadonApp/".concat(repository, "#").concat(branch, "] Error raised: ").concat(err.message || err));

    return Promise.reject(err);
  });
}

function installBrowser(target, branch, modules) {
  // Pack modules
  return (0, _promise.runSequential)(modules, function (name) {
    return pack(target, branch, name);
  }).then(function (results) {
    var versions = _merge["default"].apply(void 0, [{}].concat(_toConsumableArray(results)));

    _vorpal["default"].logger.info("Updating ".concat(Object.keys(versions).length, " package version(s)...")); // Update package versions


    return Promise.resolve().then(function () {
      return (0, _package.writePackage)(target, versions);
    }).then(function () {
      return (0, _package.writePackageLocks)(target, versions);
    });
  }).then(function () {
    _vorpal["default"].logger.info('Linking module dependencies...'); // Link module dependencies


    return linkModuleDependencies(target, branch, modules);
  }).then(function () {
    _vorpal["default"].logger.info('Installing package...'); // Install package


    return _npm["default"].install(target).then(_npm["default"].createHandler(_vorpal["default"].logger));
  });
}

function installModule(target, branch, modules) {
  _vorpal["default"].logger.info('Installing dependencies...'); // Install dependencies


  return _npm["default"].install(target).then(_npm["default"].createHandler(_vorpal["default"].logger)).then(function () {
    _vorpal["default"].logger.info('Linking modules...'); // Link modules


    return (0, _promise.runSequential)(modules, function (name) {
      return link(target, branch, name);
    });
  }).then(function () {
    _vorpal["default"].logger.info('Linking module dependencies...'); // Link module dependencies


    return linkModuleDependencies(target, branch, modules);
  });
}

function install(target, branch, options) {
  options = _objectSpread({
    reuse: false
  }, options || {}); // Build modules path

  var modulesPath = _path["default"].join(target, '.modules'); // Remove modules directory (if not reusing modules, and one exists)


  if (!options.reuse && _fsExtra["default"].existsSync(modulesPath)) {
    _vorpal["default"].logger.info('Removing existing modules...');

    _fsExtra["default"].removeSync(modulesPath);
  } // Ensure directory exists


  _mkdirp["default"].sync(modulesPath); // Read package details


  return _fsExtra["default"].readJson(_path["default"].join(target, 'package.json')).then(function (pkg) {
    var modules = (0, _package.getPackageModules)(pkg);

    _vorpal["default"].logger.info("Installing ".concat(modules.length, " module(s) to \"").concat(_path["default"].relative(_process["default"].cwd(), target) || ".".concat(_path["default"].sep), "\"...")); // Browser


    if ((0, _browser.isBrowser)(pkg['name'])) {
      return installBrowser(target, branch, modules);
    } // Module


    return installModule(target, branch, modules);
  }).then(function () {
    _vorpal["default"].logger.info('Cleaning package...'); // Clean "package-lock.json" (remove "integrity" field from modules)


    return (0, _package.writePackageLocks)(target);
  });
} // Command


var cmd = _vorpal["default"].command('travis:install <branch>', 'Install travis environment.').option('--reuse', 'Re-use existing modules').option('--target <target>', 'Target package [default: ./]'); // Action


cmd.action(function (_ref5) {
  var branch = _ref5.branch,
      options = _ref5.options;

  var target = _path["default"].resolve(options.target || _process["default"].cwd()); // Run task


  return install(target, branch, options)["catch"](function (err) {
    _vorpal["default"].logger.error(err.stack || err.message || err);

    _process["default"].exit(1);
  });
});