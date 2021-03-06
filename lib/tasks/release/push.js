"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getTargetBranches = getTargetBranches;
exports["default"] = exports.PushRelease = void 0;

var _chalk = _interopRequireDefault(require("chalk"));

var _filter = _interopRequireDefault(require("lodash/filter"));

var _find = _interopRequireDefault(require("lodash/find"));

var _isNil = _interopRequireDefault(require("lodash/isNil"));

var _isString = _interopRequireDefault(require("lodash/isString"));

var _map = _interopRequireDefault(require("lodash/map"));

var _semver = _interopRequireDefault(require("semver"));

var _promise = _interopRequireDefault(require("simple-git/promise"));

var _travisCi = _interopRequireDefault(require("travis-ci"));

var _github = _interopRequireWildcard(require("../../core/github"));

var _helpers = require("../../core/helpers");

var _release = require("./core/release");

var _helpers2 = require("./core/helpers");

var _promise2 = require("../../core/helpers/promise");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Remotes = ['bitbucket', 'origin'];
var travis = new _travisCi["default"]({
  version: '2.0.0'
});

function getTargetBranches(tag) {
  var major = _semver["default"].major(tag);

  var minor = _semver["default"].minor(tag);

  var patch = _semver["default"].patch(tag);

  var prerelease = _semver["default"].prerelease(tag); // Build target branches


  var branches = []; // - Develop

  if (patch === 0) {
    branches.push('develop');
  } // - Release


  branches.push("v".concat(major, ".").concat(minor)); // - Master

  if ((0, _isNil["default"])(prerelease)) {
    branches.push('master');
  }

  return branches;
}

function getTravisStatus(log, module, ref, options) {
  options = _objectSpread({
    createdAfter: null,
    sha: null,
    delay: 30 * 1000,
    retryAttempts: 20,
    retryInterval: 15 * 1000
  }, options || {});
  return new Promise(function (resolve, reject) {
    var attempts = 0;

    function run() {
      attempts++; // Stop retrying after the maximum attempts have been reached

      if (attempts > options.retryAttempts) {
        reject(new Error("Unable to retrieve the travis status for \"".concat(ref, "\" on ").concat(module.name)));
        return;
      }

      log.debug("[".concat(module.name, "] (GitHub) Fetching the status of \"").concat(ref, "\" ") + "in \"RadonApp/radon-extension-".concat(module.key, "\"...")); // Retrieve combined status for `ref`

      _github.GithubApi.repos.getCombinedStatusForRef({
        owner: 'RadonApp',
        repo: "radon-extension-".concat(module.key),
        ref: ref
      }).then(function (_ref) {
        var _ref$data = _ref.data,
            sha = _ref$data.sha,
            statuses = _ref$data.statuses;

        // Ensure status `sha` matches the provided `sha`
        if (!(0, _isNil["default"])(options.sha) && sha !== options.sha) {
          setTimeout(run, options.retryInterval);
          return;
        } // Find travis status


        var travis = (0, _find["default"])(statuses, {
          context: 'continuous-integration/travis-ci/push'
        });

        if ((0, _isNil["default"])(travis)) {
          setTimeout(run, options.retryInterval);
          return;
        } // Ensure travis status was created after the provided timestamp


        if (!(0, _isNil["default"])(options.createdAfter) && Date.parse(travis['created_at']) < options.createdAfter) {
          setTimeout(run, options.retryInterval);
          return;
        } // Resolve with travis status


        resolve(travis);
      }, function (err) {
        log.warn(_chalk["default"].yellow("[".concat(module.name, "] (GitHub) Unable to fetch the status of \"").concat(ref, "\": ").concat(err))); // Reject promise with error

        reject(err);
      });
    }

    log.debug("[".concat(module.name, "] Waiting ").concat(Math.round(options.delay / 1000), " seconds..."));
    setTimeout(run, options.delay);
  });
}

function awaitTravisBuild(log, module, ref, id, options) {
  options = _objectSpread({
    maximumAttempts: 120,
    maximumInterval: 45 * 1000
  }, options || {});
  return new Promise(function (resolve, reject) {
    var attempts = 0;
    var interval = 15 * 1000;

    function run() {
      attempts++;

      if (attempts === 2) {
        log.info("[".concat(module.name, "] Building \"").concat(ref, "\" on Travis CI... (2 ~ 5 minutes)"));
      } // Increase interval


      if (interval < options.maximumInterval) {
        interval = (15 + Math.floor(attempts / 5)) * 1000;
      } // Stop retrying after the maximum attempts have been reached


      if (attempts > options.maximumAttempts) {
        reject(new Error("Build timeout for \"".concat(id, "\"")));
        return;
      }

      log.debug("[".concat(module.name, "] (Travis CI) Fetching the state of build ").concat(id, "...")); // Retrieve build details for `id`

      travis.builds(id).get(function (err, res) {
        if (err) {
          log.warn("[".concat(module.name, "] (Travis CI) Error: ").concat(err && err.stack ? err.stack : err, " ") + "(will try again in ".concat(options.maximumInterval / 1000, "s)")); // Back-off and try again at the maximum interval

          setTimeout(run, options.maximumInterval);
          return;
        }

        var build = res.build,
            commit = res.commit; // Ensure the correct build was returned

        if (commit['branch'] !== ref) {
          reject(new Error("Incorrect build selected (expected: ".concat(ref, ", found: ").concat(commit['branch'], ")")));
          return;
        }

        log.debug("[".concat(module.name, "] (Travis CI) State: ").concat(build['state'])); // Ensure build has finished

        if (['created', 'started'].indexOf(build['state']) >= 0) {
          setTimeout(run, interval);
          return;
        } // Resolve with final state


        resolve(build['state']);
      });
    }

    run();
  });
}

function awaitBuild(log, module, ref, options) {
  options = _objectSpread({
    dryRun: false
  }, options || {}); // Resolve immediately for dry runs

  if (options.dryRun) {
    log.info("Waiting for \"".concat(ref, "\" on \"RadonApp/").concat(module.name, "\" to finish building (skipped, dry run)"));
    return Promise.resolve('success');
  } // Retrieve travis status for `ref`


  return getTravisStatus(log, module, ref, options).then(function (status) {
    var parameters = /https:\/\/travis-ci\.org\/.*?\/.*?\/builds\/(\d+)/.exec(status['target_url']); // Ensure parameters are valid

    if ((0, _isNil["default"])(parameters) || parameters.length !== 2) {
      return Promise.reject(new Error("Unknown travis status \"target_url\": \"".concat(status['target_url'], "\"")));
    } // Await travis build to complete


    return awaitTravisBuild(log, module, ref, parameters[1]);
  });
}

function pushBranch(log, module, remotes, tag, branch, options) {
  options = _objectSpread({
    dryRun: false
  }, options || {});
  var startedAt = null;
  return (0, _promise2.runSequential)(remotes, function (remote) {
    // Retrieve current remote commit (from local)
    return module.repository.revparse("".concat(remote, "/").concat(branch))["catch"](function () {
      return null;
    }).then(function (currentCommit) {
      if (!(0, _isNil["default"])(currentCommit) && currentCommit.trim() === module.commit) {
        log.debug("[".concat(module.name, "] ").concat(tag, " has already been pushed to \"").concat(branch, "\" on \"").concat(remote, "\""));
        return Promise.resolve();
      }

      if (remote === 'origin') {
        startedAt = Date.now();
      } // Ignore push for dry runs


      if (!options.dryRun) {
        log.debug("[".concat(module.name, "] Pushing ").concat(tag, " to \"").concat(branch, "\" on \"").concat(remote, "\""));
      } else {
        log.debug("[".concat(module.name, "] Pushing ").concat(tag, " to \"").concat(branch, "\" on \"").concat(remote, "\" (skipped, dry run)"));
        return Promise.resolve();
      } // Push branch to remote


      return module.repository.push(remote, "+".concat(tag, "~0:refs/heads/").concat(branch));
    });
  }).then(function () {
    if ((0, _isNil["default"])(startedAt) || remotes.indexOf('origin') < 0) {
      return Promise.resolve();
    } // Wait for build to complete


    return awaitBuild(log, module, branch, {
      dryRun: options.dryRun,
      sha: module.commit,
      createdAfter: startedAt
    }).then(function (state) {
      if (state !== 'passed') {
        return Promise.reject(new Error("Build failed for ".concat(module.name, "#").concat(branch)));
      } // Build successful


      return Promise.resolve();
    });
  });
}

function pushTag(log, module, remotes, tag, options) {
  options = _objectSpread({
    dryRun: false
  }, options || {}); // Push tag to remote

  return (0, _promise2.runSequential)(remotes, function (remote) {
    if (!options.dryRun) {
      log.debug("[".concat(module.name, "] Pushing ").concat(tag, " tag to \"").concat(remote, "\""));
    } else {
      log.debug("[".concat(module.name, "] Pushing ").concat(tag, " tag to \"").concat(remote, "\" (skipped, dry run)"));
      return Promise.resolve();
    } // Push tag to remote


    return module.repository.push(remote, "refs/tags/".concat(tag));
  }).then(function () {
    if (remotes.indexOf('origin') < 0) {
      return Promise.resolve();
    } // Wait for build to complete


    return awaitBuild(log, module, tag, {
      dryRun: options.dryRun,
      sha: module.commit,
      // Wait 15s before the first status request (hopefully enough time for the status to be updated)
      delay: 15 * 1000
    }).then(function (state) {
      if (state !== 'passed') {
        return Promise.reject(new Error("Build failed for ".concat(module.name, "#").concat(tag)));
      } // Create release on GitHub


      if (module.type !== 'package') {
        return (0, _release.createRelease)(log, module, module.repository, tag, {
          dryRun: options.dryRun
        });
      }

      return Promise.resolve();
    });
  });
}

function pushRelease(log, browser, remotes, options) {
  var dryRun = options['dry-run'] || false;

  if ((0, _isString["default"])(remotes)) {
    remotes = [remotes];
  } else if ((0, _isNil["default"])(remotes)) {
    remotes = Remotes;
  } else if (!Array.isArray(remotes)) {
    return Promise.reject("Invalid remotes: ".concat(remotes));
  }

  var packageRepository = (0, _promise["default"])(browser.extension.path).silent(true);
  var modules = (0, _helpers2.getPackages)(browser);
  var pushed = {}; // Retrieve current version

  return packageRepository.raw(['describe', '--abbrev=0', '--match=v*', '--tags', '--exact-match']).then(function (tag) {
    tag = tag.trim(); // Validate version

    if (tag.length < 1 || tag.indexOf('v') !== 0 || !_semver["default"].valid(tag)) {
      return Promise.reject(new Error("Unable to push release, ".concat(browser.extension.name, " has an invalid version tag: ").concat(tag)));
    } // Resolve promise with package `tag`


    return tag;
  }, function () {
    return Promise.reject(new Error('No release available to push'));
  }).then(function (tag) {
    // Resolve modules that match the package `tag`
    return (0, _promise2.runSequential)(modules, function (module) {
      var repository = (0, _promise["default"])(module.path).silent(true); // Retrieve current version

      return repository.raw(['describe', '--abbrev=0', '--match=v*', '--tags', '--exact-match']).then(function (moduleTag) {
        moduleTag = moduleTag.trim(); // Ignore modules with no release matching the package `tag`

        if (moduleTag !== tag) {
          return Promise.resolve();
        } // Resolve version commit sha


        return repository.revparse("".concat(tag, "~0")).then(function (commit) {
          return {
            key: module.key,
            type: module.type,
            name: module.name,
            path: module.path,
            commit: commit.trim(),
            repository: repository
          };
        });
      }, function () {
        log.warn("[".concat(module.name, "] ").concat(_chalk["default"].yellow('No release available to push')));
      });
    }).then(function (modules) {
      return (// Remove ignored modules
        (0, _filter["default"])(modules, function (module) {
          return !(0, _isNil["default"])(module);
        })
      );
    }).then(function (modules) {
      return Promise.resolve() // Push branches to remote(s)
      .then(function () {
        return (0, _promise2.runSequential)(getTargetBranches(tag), function (branch) {
          return Promise.all((0, _map["default"])(modules, function (module) {
            log.info("[".concat(module.name, "] ").concat(_chalk["default"].cyan("Pushing ".concat(tag, " (").concat(module.commit, ") -> ").concat(branch, " (remotes: ").concat(remotes.join(', '), ")")))); // Push branch for module to remote(s)

            return pushBranch(log, module, remotes, tag, branch, {
              dryRun: dryRun
            }).then(function () {
              log.info("[".concat(module.name, "] ").concat(_chalk["default"].green("Pushed ".concat(tag, " (").concat(module.commit, ") -> ").concat(branch, " (remotes: ").concat(remotes.join(', '), ")"))));
            });
          }));
        });
      }) // Push tag to remote(s)
      .then(function () {
        return Promise.all((0, _map["default"])(modules, function (module) {
          log.info("[".concat(module.name, "] ").concat(_chalk["default"].cyan("Pushing ".concat(tag, " (").concat(module.commit, ") -> ").concat(tag, " (remotes: ").concat(remotes.join(', '), ")")))); // Push tag for module to remote(s)

          return pushTag(log, module, remotes, tag, {
            dryRun: dryRun
          }).then(function () {
            log.info("[".concat(module.name, "] ").concat(_chalk["default"].green("Pushed ".concat(tag, " (").concat(module.commit, ") -> ").concat(tag, " (remotes: ").concat(remotes.join(', '), ")")))); // Mark module as pushed

            pushed[module.name] = true;
          });
        }));
      });
    }).then(function () {
      if (pushed[browser.extension.name] !== true) {
        log.debug("[".concat(browser.extension.name, "] No release pushed, ignoring the generation of release notes"));
        return Promise.resolve();
      } // Update package release


      return (0, _release.updatePackageRelease)(log, browser.extension, packageRepository, modules, tag, {
        dryRun: dryRun
      });
    });
  });
}

var PushRelease = _helpers.Task.create({
  name: 'release:push',
  description: 'Push release to remote(s).',
  command: function command(cmd) {
    return cmd.option('--dry-run', 'Don\'t execute any actions').option('--remote <remote>', 'Remote [default: all]', Remotes);
  }
}, function (log, browser, environment, _ref2) {
  var remote = _ref2.remote,
      options = _objectWithoutProperties(_ref2, ["remote"]);

  // Ensure account is authenticated
  return _github["default"].isAuthenticated().then(function () {
    return (// Push release to GitHub
      pushRelease(log, browser, remote, options)
    );
  });
}, {
  remote: null
});

exports.PushRelease = PushRelease;
var _default = PushRelease;
exports["default"] = _default;