const bogus = ['Dangerous comment',];

const warnings = [
    [
        'Expected \'{\'',
        'Statement body should be inside \'{ }\' braces.',
    ],
];

const errors = [
    'Missing semicolon',
    'Extra comma',
    'Missing property name',
    'Unmatched ',
    ' and instead saw',
    ' is not defined',
    'Unclosed string',
    'Stopping, unable to continue',
];

let jshint = null;

function doValidaton(text, options) {
    jshint(text, options, options.globals);
    const foundErrors = jshint.data().errors;
    const result = [];
    if (foundErrors) {
        parseErrors(foundErrors, result);
    }
    return Promise.resolve(result);
}

export function asyncValidator(text, options) {
    if (jshint === null) {
        return import('jshint')
            .then(({JSHINT,}) => jshint = JSHINT)
            .then(() => doValidaton(text, options))
            .catch(() => Promise.resolve([]));
    } else {
        return doValidaton(text, options);
    }
}

function cleanup(error) {
    // All problems are warnings by default
    fixWith(error, warnings, 'warning', true);
    fixWith(error, errors, 'error');

    return isBogus(error) ? null : error;
}

function fixWith(error, fixes, severity, force) {
    const description = error.description;

    for (let i = 0; i < fixes.length; i++) {
        const fix = fixes[i];
        const find = (typeof fix === 'string' ? fix : fix[0]);
        const replace = (typeof fix === 'string' ? null : fix[1]);
        const found = description.indexOf(find) !== -1;

        if (force || found) {
            error.severity = severity;
        }
        if (found && replace) {
            error.description = replace;
        }
    }
}

function isBogus(error) {
    const description = error.description;
    for (let i = 0; i < bogus.length; i++) {
        if (description.includes(bogus[i])) {
            return true;
        }
    }
    return false;
}

function parseErrors(foundErrors, output) {
    for (let i = 0; i < foundErrors.length; i++) {
        let error = foundErrors[i];
        if (error) {
            const linetabpositions = [];

            // This next block is to fix a problem in jshint. Jshint
            // replaces
            // all tabs with spaces then performs some checks. The error
            // positions (character/space) are then reported incorrectly,
            // not taking the replacement step into account. Here we look
            // at the evidence line and try to adjust the character position
            // to the correct value.
            if (error.evidence) {
                // Tab positions are computed once per line and cached
                let tabpositions = linetabpositions[error.line];
                if (!tabpositions) {
                    const evidence = error.evidence;
                    tabpositions = [];
                    // ugggh phantomjs does not like this
                    // forEachChar(evidence, function(item, index) {
                    Array.prototype.forEach.call(evidence, (item, index) => {
                        if (item === '\t') {
                            // First col is 1 (not 0) to match error
                            // positions
                            tabpositions.push(index + 1);
                        }
                    });
                    linetabpositions[error.line] = tabpositions;
                }
                if (tabpositions.length > 0) {
                    let pos = error.character;
                    tabpositions.forEach((tabposition) => {
                        if (pos > tabposition) {
                            pos -= 1;
                        }
                    });
                    error.character = pos;
                }
            }

            const start = error.character - 1;
            let end = start + 1;
            if (error.evidence) {
                const index = error.evidence.substring(start).search(/.\b/);
                if (index > -1) {
                    end += index;
                }
            }

            // Convert to format expected by validation service
            error.description = error.reason;// + "(jshint)";
            error.start = error.character;
            error.end = end;
            error = cleanup(error);

            if (error) {
                output.push({
                    message: error.description,
                    severity: error.severity,
                    from: CodeMirror.Pos(error.line - 1, start), // eslint-disable-line new-cap
                    to: CodeMirror.Pos(error.line - 1, end), // eslint-disable-line new-cap
                });
            }
        }
    }
}