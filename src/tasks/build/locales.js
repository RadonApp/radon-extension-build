import Chalk from 'chalk';
import Filesystem from 'fs-extra';
import Map from 'lodash/map';
import Mkdirp from 'mkdirp';
import PadEnd from 'lodash/padEnd';
import Path from 'path';

import Copy from '../../core/copy';
import {Task} from '../../core/helpers';


function copyLocaleNamespaces(log, module, language, destinationPath) {
    let localePath = Path.join(module.path, 'Locales', language);

    if(!Filesystem.existsSync(localePath)) {
        return Promise.resolve();
    }

    // Copy locale namespaces to the build directory
    return Copy('**/*.json', localePath, `${destinationPath}/${language}/${module.key}`).then((files) => {
        log.info(Chalk.green(
            `[${PadEnd(module.name, 40)}](${language}) Copied ${files.length} namespace(s)`
        ));
    }, (err) => {
        log.info(Chalk.red(
            `[${PadEnd(module.name, 40)}] Unable to copy locales: ${err.message}`
        ));
        return Promise.reject(err);
    });
}

export const Locales = Task.create({
    name: 'build:locales',
    description: 'Build extension locales.',

    required: [
        'clean',
        'module:validate'
    ]
}, function(log, browser, environment) {
    let destinationPath = Path.join(environment.outputPath, 'Locales');

    // Ensure output directory exists
    Mkdirp.sync(destinationPath);

    // Copy locales to the build directory
    return Promise.all(Map(browser.modules, (module) => {
        let localesPath = Path.join(module.path, 'Locales');

        if(!Filesystem.existsSync(localesPath)) {
            return Promise.resolve();
        }

        // Copy locale namespaces to the build directory
        return Filesystem.readdir(localesPath).then((languages) =>
            Promise.all(Map(languages, (language) =>
                copyLocaleNamespaces(log, module, language, destinationPath)
            ))
        );
    }));
});

export default Locales;
