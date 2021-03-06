"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createDependencyTree = createDependencyTree;
exports.getDependencyTree = getDependencyTree;
exports.orderModules = orderModules;
exports.getBrowserModules = getBrowserModules;
exports.getPackageModules = getPackageModules;
exports.readPackageModules = readPackageModules;
exports.readPackageDetails = readPackageDetails;
exports.parsePackageDependency = parsePackageDependency;
exports.updatePackage = updatePackage;
exports.writePackage = writePackage;
exports.updatePackageLocks = updatePackageLocks;
exports.writePackageLocks = writePackageLocks;
exports["default"] = exports.Dependency = void 0;

var _cloneDeep = _interopRequireDefault(require("lodash/cloneDeep"));

var _fsExtra = _interopRequireDefault(require("fs-extra"));

var _isEqual = _interopRequireDefault(require("lodash/isEqual"));

var _isNil = _interopRequireDefault(require("lodash/isNil"));

var _isPlainObject = _interopRequireDefault(require("lodash/isPlainObject"));

var _mapValues = _interopRequireDefault(require("lodash/mapValues"));

var _merge = _interopRequireDefault(require("lodash/merge"));

var _path = _interopRequireDefault(require("path"));

var _pickBy = _interopRequireDefault(require("lodash/pickBy"));

var _without = _interopRequireDefault(require("lodash/without"));

var _forEach = _interopRequireDefault(require("lodash/forEach"));

var _filter = _interopRequireDefault(require("lodash/filter"));

var _values = _interopRequireDefault(require("lodash/values"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var Dependency = /*#__PURE__*/function () {
  function Dependency(values) {
    _classCallCheck(this, Dependency);

    // Parse values
    var _name$version$require = _objectSpread({
      name: null,
      version: null,
      requires: {},
      parent: null,
      extras: {}
    }, values || {}),
        name = _name$version$require.name,
        version = _name$version$require.version,
        requires = _name$version$require.requires,
        parent = _name$version$require.parent,
        extras = _name$version$require.extras; // Validate values


    if ((0, _isNil["default"])(name)) {
      throw new Error('Missing required "name" value');
    }

    if ((0, _isNil["default"])(version)) {
      throw new Error('Missing required "version" value');
    } // Set values


    this.name = name;
    this.version = version;
    this.requires = requires;
    this.parent = parent;
    this.extras = extras;
    this.dependencies = {};
  }

  _createClass(Dependency, [{
    key: "get",
    value: function get(name) {
      return this.dependencies[name] || null;
    }
  }, {
    key: "resolve",
    value: function resolve(name) {
      var dependency = this.get(name);

      if (!(0, _isNil["default"])(dependency)) {
        return dependency;
      } // Try resolve in parent


      if ((0, _isNil["default"])(this.parent)) {
        return null;
      }

      return this.parent.resolve(name);
    }
  }, {
    key: "integrity",
    get: function get() {
      return this.extras.integrity || null;
    }
  }]);

  return Dependency;
}();

exports.Dependency = Dependency;

function createDependencyTree(dependency) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  options = _objectSpread({
    name: null,
    parent: null
  }, options || {}); // Parse dependency

  var _name$version$require2 = _objectSpread({
    name: options.name,
    version: null,
    requires: {},
    dependencies: {}
  }, dependency),
      name = _name$version$require2.name,
      version = _name$version$require2.version,
      requires = _name$version$require2.requires,
      dependencies = _name$version$require2.dependencies,
      extras = _objectWithoutProperties(_name$version$require2, ["name", "version", "requires", "dependencies"]); // Create dependency node


  var node = new Dependency({
    name: name,
    version: version,
    requires: requires,
    extras: extras,
    parent: options.parent
  }); // Parse dependencies

  node.dependencies = (0, _mapValues["default"])(dependencies, function (dep, name) {
    return createDependencyTree(dep, {
      parent: node,
      name: name
    });
  });
  return node;
}

function getDependencyTree(path) {
  return _fsExtra["default"].readJson(_path["default"].join(path, 'package-lock.json')).then(function (dependency) {
    return createDependencyTree(dependency);
  });
}

function orderModules(modules) {
  var result = [];
  (0, _forEach["default"])(['@radon-extension/build', '@radon-extension/framework', '@radon-extension/core'], function (name) {
    if (modules.indexOf(name) < 0) {
      return;
    }

    result.push(name);
  }); // Append remaining modules

  return result.concat(_without["default"].apply(void 0, [modules].concat(result)));
}

function getBrowserModules(browser) {
  return [browser.modules['build'], browser.modules['framework'], browser.modules['core']].concat(_toConsumableArray((0, _filter["default"])((0, _values["default"])(browser.modules), function (module) {
    return ['@radon-extension/build', '@radon-extension/framework', '@radon-extension/core'].indexOf(module.name) < 0;
  })));
}

function getPackageModules(pkg) {
  if (pkg.name.indexOf('@radon-extension/') !== 0) {
    throw new Error("Invalid module: ".concat(pkg.name));
  }

  return orderModules((0, _filter["default"])([].concat(_toConsumableArray(Object.keys(pkg.dependencies || {})), _toConsumableArray(Object.keys(pkg.peerDependencies || {}))), function (name) {
    return name.indexOf('@radon-extension/') === 0;
  }));
}

function readPackageModules(path) {
  return _fsExtra["default"].readJson(path).then(function (pkg) {
    return getPackageModules(pkg);
  });
}

function parsePackageDetails(data) {
  return (0, _merge["default"])({
    name: null,
    version: null,
    description: null,
    keywords: null,
    homepage: null,
    author: null,
    license: null,
    main: null,
    "private": null,
    bugs: null,
    engines: null,
    repository: null,
    dependencies: {},
    devDependencies: {},
    peerDependencies: {},
    bin: null,
    scripts: null
  }, data);
}

function readPackageDetails(path) {
  // Read package details from file
  return _fsExtra["default"].readJson(_path["default"].join(path, 'package.json')).then(function (data) {
    if (!(0, _isPlainObject["default"])(data)) {
      return Promise.reject(new Error('Expected manifest to be a plain object'));
    } // Parse package details


    return parsePackageDetails(data);
  });
}

function parsePackageDependency(dep) {
  if (!(0, _isPlainObject["default"])(dep)) {
    dep = {
      version: dep
    };
  }

  return _objectSpread({
    from: null,
    version: null
  }, dep || {});
}

function updatePackage(pkg) {
  var versions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  versions = versions || {};
  options = _objectSpread({
    formatVersion: function formatVersion(version) {
      return version;
    }
  }, options || {});

  function updateVersions(pkg, group) {
    var dependencies = pkg[group];

    if ((0, _isNil["default"])(dependencies)) {
      return dependencies;
    }

    return _objectSpread({}, dependencies, {}, (0, _mapValues["default"])((0, _pickBy["default"])(versions, function (_, name) {
      return !(0, _isNil["default"])(dependencies[name]);
    }), function (dep, name) {
      var _parsePackageDependen = parsePackageDependency(dep),
          version = _parsePackageDependen.version;

      if ((0, _isNil["default"])(version)) {
        throw new Error("Invalid version defined for \"".concat(name, "\": ").concat(version));
      }

      return options.formatVersion(version, name, group);
    }));
  }

  if (!(0, _isNil["default"])(pkg.dependencies) && Object.keys(pkg.dependencies).length > 0) {
    pkg.dependencies = updateVersions(pkg, 'dependencies');
  }

  if (!(0, _isNil["default"])(pkg.peerDependencies) && Object.keys(pkg.peerDependencies).length > 0) {
    pkg.peerDependencies = updateVersions(pkg, 'peerDependencies');
  }

  return pkg;
}

function writePackage(path) {
  var versions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

  if (_fsExtra["default"].statSync(path).isDirectory()) {
    path = _path["default"].join(path, 'package.json');
  } // Read package details


  return _fsExtra["default"].readFile(path).then(function (data) {
    var previous = JSON.parse(data); // Update package versions

    var current = updatePackage((0, _cloneDeep["default"])(previous), versions, options);

    if ((0, _isEqual["default"])(previous, current)) {
      return Promise.resolve(false);
    } // Write package details


    return _fsExtra["default"].writeJson(path, current, {
      EOL: data.indexOf('\r\n') >= 0 ? '\r\n' : '\n',
      spaces: 2
    }).then(function () {
      return true;
    });
  });
}

function updatePackageLocks(locks) {
  var versions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  versions = versions || {};
  options = _objectSpread({
    formatVersion: function formatVersion(version) {
      return version;
    }
  }, options || {}); // Update package locks

  return _objectSpread({}, locks, {
    // Update package version
    version: versions[locks.name] || locks.version,
    // Update dependencies
    dependencies: _objectSpread({}, locks.dependencies, {}, (0, _mapValues["default"])((0, _pickBy["default"])(locks.dependencies, function (_, name) {
      return name.indexOf('@radon-extension/') === 0;
    }), function (dependency, name) {
      // Update version (if provided)
      if (!(0, _isNil["default"])(versions[name])) {
        var _parsePackageDependen2 = parsePackageDependency(versions[name]),
            from = _parsePackageDependen2.from,
            version = _parsePackageDependen2.version; // Update package "version"


        if ((0, _isNil["default"])(version)) {
          throw new Error("Invalid version defined for \"".concat(name, "\": ").concat(version));
        }

        dependency.version = options.formatVersion(version, name); // Update package "from"

        if (!(0, _isNil["default"])(from)) {
          dependency.from = from;
        } else if (!(0, _isNil["default"])(dependency.from)) {
          delete dependency.from;
        }
      } // Ensure "integrity" field hasn't been defined


      if (!(0, _isNil["default"])(dependency.integrity)) {
        delete dependency.integrity;
      }

      return dependency;
    }))
  });
}

function writePackageLocks(path) {
  var versions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

  if (_fsExtra["default"].statSync(path).isDirectory()) {
    path = _path["default"].join(path, 'package-lock.json');
  } // Ensure package locks exist


  if (!_fsExtra["default"].existsSync(path)) {
    return Promise.resolve(false);
  } // Read package locks


  return _fsExtra["default"].readFile(path).then(function (data) {
    var previous = JSON.parse(data); // Update package locks

    var current = updatePackageLocks((0, _cloneDeep["default"])(previous), versions, options);

    if ((0, _isEqual["default"])(previous, current)) {
      return Promise.resolve(false);
    } // Write package locks


    return _fsExtra["default"].writeJson(path, current, {
      EOL: data.indexOf('\r\n') >= 0 ? '\r\n' : '\n',
      spaces: 2
    }).then(function () {
      return true;
    });
  });
}

var _default = {
  getBrowserModules: getBrowserModules,
  getPackageModules: getPackageModules,
  orderModules: orderModules,
  readPackageDetails: readPackageDetails,
  readPackageModules: readPackageModules,
  updatePackage: updatePackage,
  updatePackageLocks: updatePackageLocks,
  writePackage: writePackage,
  writePackageLocks: writePackageLocks
};
exports["default"] = _default;