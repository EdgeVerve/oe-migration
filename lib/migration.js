var path = require('path');
var fs = require('fs');
var loopback = require('loopback');
var semver = require('semver');
var async = require('async');
var opts = {
    ignoreAutoScope: true,
    fetchAllScopes: true
};
var options;
var MigrationLog;
var basePath = path.resolve(process.cwd(), typeof global.it !== 'function' ? '' : 'test', 'db');
var moduleName = './';
var validationFunctions = {};
var startTime;
var endTime;
var warnings = [];
var structureChanged = [];
function getBasePath() {
    return basePath;
}

function setBasePath(bPath) {
    basePath = bPath;
    if (!basePath) basePath = path.resolve(process.cwd(), typeof global.it !== 'function' ? '' : 'test', 'db');
}

function migrate(mOptions, mCb) {
    startTime = new Date().getTime();
    if (mOptions && !mCb && typeof mOptions === 'function') {
        mCb = mOptions;
        mOptions = {};
    }
    basePath = (mOptions && mOptions.basePath) || basePath;
    moduleName = (mOptions && mOptions.moduleName) || './';
    var migrationCb = function (err, oldDbVersion, migratedVersions) {
        endTime = new Date().getTime();
        // eslint-disable-next-line no-console
        console.log('Previous DB Version:', oldDbVersion);
        // eslint-disable-next-line no-console
        console.log('Migrated Versions  :', JSON.stringify(migratedVersions));
        if (err) {
            // eslint-disable-next-line no-console
            console.error('ERROR: ' + err.message ? err.message : err);
        }
        // eslint-disable-next-line no-console
        console.log('NOTE: "MigrationLog" table may have useful logs');
        // eslint-disable-next-line no-console
        console.log('Data Migration completed in ' + (endTime - startTime) / 1000 + ' sec');
        // eslint-disable-next-line no-console
        console.log('Data Migration Ended: ' + new Date());
        // eslint-disable-next-line no-console
        console.log('\n**************************************************************************************');
        var data = {migratedVersions: migratedVersions};
        if (warnings.length > 0) data.warnings = warnings;
        if (mCb) mCb(err, oldDbVersion, data);
    };

    options = mOptions;
    // eslint-disable-next-line no-console
    console.log('\n\n**************************************************************************************');
    // eslint-disable-next-line no-console
    console.log('Data Migration Started: ' + new Date());
    // eslint-disable-next-line no-console
    console.log('Migration options :', JSON.stringify(options));
    // eslint-disable-next-line no-console
    console.log('Base Path for data:', basePath);
    MigrationLog = loopback.findModel('MigrationLog');
    getListOfMigrationPaths(options, function (err, data) {
        var list;
        var lastVersion;
        var dbVersionInstance;
        var migratedVersions;
        var oldDbVersion;
        list = data && data.migrationDirs;
        lastVersion = data && data.migratedVersions[data.migratedVersions.length - 1];
        dbVersionInstance = data && data.dbVersionInstance;
        migratedVersions = data && data.migratedVersions;
        oldDbVersion = dbVersionInstance && dbVersionInstance.value ? dbVersionInstance.value : null;
        if (err) return migrationCb(err, oldDbVersion, null);
        async.eachSeries(list, migrateFromPath, function finalCb(err) {
            if (err) migrationCb(err, oldDbVersion, null);
            else if (lastVersion) {
                if (dbVersionInstance) {
                    dbVersionInstance.updateAttribute('value', lastVersion, opts, function (err, data) {
                        /* istanbul ignore if */
                        if (err || !data) {
                            migrationCb(err, oldDbVersion, null);
                        } else {
                            // eslint-disable-next-line no-console
                            console.log('Migration done. DB updated to', data.value);
                            logMigration({'logType': 'INFO', 'model': null, 'dbVersion': data.value, 'filePath': null,
                                'migrationDate': new Date(), 'tenant': null, 'log': {'message': 'Migration done. DB updated to ' + data.value}});
                            migrationCb(null, oldDbVersion, migratedVersions);
                        }
                    });
                } else {
                    var SystemConfig = loopback.findModel('SystemConfig');
                    var versionKey = 'dbVersion.' + moduleName;
                    SystemConfig.create({
                        'key': versionKey,
                        'value': lastVersion
                    }, opts, function (err, data) {
                        /* istanbul ignore if */
                        if (err || !data) {
                            migrationCb(err, oldDbVersion, null);
                        } else {
                            // eslint-disable-next-line no-console
                            console.log('Migration done. DB updated to', data.value);
                            migrationCb(null, oldDbVersion, migratedVersions);
                        }
                    });
                }
            } else {
                // eslint-disable-next-line no-console
                console.log('Nothing to migrate or DB is up-to-date');
                migrationCb(null, oldDbVersion, null);
            }
        });
    });
}


function migrateFromPath(migrationPath, cb) {
    /* istanbul ignore else */
    if (options.verbose) {
    // eslint-disable-next-line no-console
        console.log('Migrating from:', migrationPath);
    }
    var dbVersion = migrationPath.substring(1 + getBasePath().length);
    var metaPath = path.join(migrationPath, 'meta.json');
    if (fs.existsSync(metaPath)) {
        var meta;
        try {
            meta = require(metaPath);
        } catch (e) {
            var msg = e.message;
            logMigration({'logType': 'ERROR', 'model': null, 'dbVersion': dbVersion, 'filePath': null,
                'migrationDate': new Date(), 'tenant': null, 'log': {'message': msg }});
            var err = new Error(msg);
            return cb(err);
        }
        updateDatabaseStructuresIfRequired();
        // eslint-disable-next-line no-inner-declarations
        function updateDatabaseStructuresIfRequired() {
            var ddlDir = path.resolve(migrationPath, 'ddl');
            if (fs.existsSync(ddlDir)) {
                var modelDefJSONs = (fs.readdirSync(ddlDir)).map(function (f) {return path.join(ddlDir, f); });
                async.eachSeries(modelDefJSONs, function (modelDefJSON, asyncCb3) {
                    var modelDefSettings = require(modelDefJSON);
                    var Model = loopback.findModel(modelDefSettings.name);
                    if (Model) {
                        prepareTable(modelDefSettings.name, function (err) {
                            if (err) return asyncCb3(err);
                            updateStructure();
                        });
                        // eslint-disable-next-line no-inner-declarations
                        function updateStructure() {
                            var opts = { ctx: {} };
                            opts.ctx = (meta.contexts && modelDefSettings.migrationCtxId && meta.contexts[modelDefSettings.migrationCtxId]) || {};
                            var ds = Model.getDataSource(opts);
                            var settings = {};
                            settings.base = modelDefSettings.base;
                            settings.description = modelDefSettings.description;
                            settings.idinjection = modelDefSettings.idinjection;
                            settings.mixins = modelDefSettings.mixins;
                            settings.options = modelDefSettings.options;
                            settings.relations = modelDefSettings.relations;
                            settings.validations = modelDefSettings.validations;
                            settings.autoscope = modelDefSettings.autoscope;
                            Model = loopback.createModel(modelDefSettings.name, modelDefSettings.properties, settings);
                            Model.attachTo(ds);
                            ds.autoupdate(modelDefSettings.name, function (err, result) {
                                /* istanbul ignore if */
                                if (err) {
                                    // eslint-disable-next-line no-console
                                    console.error(err.message || err);
                                    logMigration({'logType': 'ERROR', 'model': modelDefSettings.name, 'dbVersion': dbVersion, 'filePath': null,
                                        'migrationDate': new Date(), 'tenant': null, 'log': {'message': err.message || JSON.stringify(err) }});
                                    asyncCb3(err);
                                } else {
                                    ds.discoverModelProperties(modelDefSettings.name, function (err, props) {
                                        /* istanbul ignore if */
                                        if (err) {
                                            // eslint-disable-next-line no-console
                                            console.error(err.message || err);
                                            logMigration({'logType': 'ERROR', 'model': modelDefSettings.name, 'dbVersion': dbVersion, 'filePath': null,
                                                'migrationDate': new Date(), 'tenant': null, 'log': {'message': err.message || JSON.stringify(err) }});
                                            asyncCb3(err);
                                        } else {
                                            structureChanged.push(modelDefSettings.name);
                                            asyncCb3();
                                        }
                                    });
                                }
                            });
                        }
                    } else {
                        var msg = 'Model ' + modelDefSettings.name + ' specified in ' + ddlDir + ' does not exist';
                        // eslint-disable-next-line no-console
                        console.error(msg);
                        logMigration({'logType': 'ERROR', 'model': modelDefSettings.name, 'dbVersion': dbVersion, 'filePath': null,
                            'migrationDate': new Date(), 'tenant': null, 'log': {'message': msg }});
                        asyncCb3(new Error(msg));
                    }
                }, function (err) {
                    /* istanbul ignore else */
                    if (err) {
                        var msg = err.message;
                        logMigration({'logType': 'ERROR', 'model': null, 'dbVersion': dbVersion, 'filePath': null,
                            'migrationDate': new Date(), 'tenant': null, 'log': {'message': msg }});
                        return cb(err);
                    }
                    clearTablesIfRequired();
                } );
            } else {
                clearTablesIfRequired();
            }
        }
        // eslint-disable-next-line no-inner-declarations
        function clearTablesIfRequired() {
            if (meta.clearTables && meta.clearTables.length && meta.clearTables.length > 0) {
                async.eachSeries(meta.clearTables, clearTable, function (err) {
                    if (err) {
                        var msg = err.message;
                        logMigration({'logType': 'ERROR', 'model': null, 'dbVersion': dbVersion, 'filePath': null,
                            'migrationDate': new Date(), 'tenant': null, 'log': {'message': msg }});
                        return cb(err);
                    }

                    process();
                });
            } else if (meta.clearTables === true) {
                var allTables = meta.files.map(function (f) {return f.model; });
                allTables = allTables.filter(function (elem, pos) {
                    return allTables.indexOf(elem) === pos;
                });
                async.eachSeries(allTables, clearTable, function (err) {
                    /* istanbul ignore if */
                    if (err) {
                        var msg = err.message;
                        logMigration({'logType': 'ERROR', 'model': null, 'dbVersion': dbVersion, 'filePath': null,
                            'migrationDate': new Date(), 'tenant': null, 'log': {'message': msg }});
                        return cb(err);
                    }
                    process();
                });
            } else process();
        }


        // eslint-disable-next-line no-inner-declarations
        function process() {
            if (!meta.files) {
                msg = 'WARNING: No files key found in meta.json at ' + metaPath;
                warnings.push(msg);
                // eslint-disable-next-line no-console
                console.warn(msg);
                logMigration({'logType': 'WARN', 'model': null, 'dbVersion': dbVersion, 'filePath': null,
                    'migrationDate': new Date(), 'tenant': null, 'log': {'message': msg }});
            }
            async.eachSeries(meta.files, function (value, asyncCb) {
                if (value.enabled === false) {
                    /* istanbul ignore else */
                    if (options.verbose) {
                        // eslint-disable-next-line no-console
                        console.log('Ignoring path as it is disabled in meta.json:', value.file);
                    }
                    return asyncCb();
                }
                var filePath = path.join(migrationPath, value.file);

                /* istanbul ignore else */
                if (options.verbose) {
                    // eslint-disable-next-line no-console
                    console.log('Running migration for file ', filePath);
                }
                var opts = { ctx: {} };
                opts.ctx = meta.contexts && meta.contexts[value.ctxId];
                if (!opts.ctx) {
                    var msg = 'ctxId \'' + value.ctxId + '\' not found in contexts of ' + metaPath;
                    var mLog = {'logType': 'FATAL', 'model': value.model, 'dbVersion': dbVersion, 'filePath': filePath,
                        'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': msg}};
                    var err = new Error(msg);
                    err.mLog = mLog;
                    return asyncCb(err);
                }

                if (structureChanged.indexOf(value.model) > -1) {
                    restoreTableData(value.model, function (err) {
                        /* istanbul ignore if */
                        if (err) {
                            var mLog = {'logType': 'FATAL', 'model': value.model, 'dbVersion': dbVersion, 'filePath': null,
                                'migrationDate': new Date(), 'tenant': null, 'log': {'message': err.message || JSON.stringify(err) }};
                            err.mLog = mLog;
                            return asyncCb(err);
                        }
                        structureChanged.splice(structureChanged.indexOf(value.model), 1);
                        proceedWithMigration();
                    });
                } else {
                    proceedWithMigration();
                }

                function proceedWithMigration() {
                    if (filePath.endsWith('json')) {
                        var model = loopback.findModel(value.model);
                        if (!model) {
                            msg = value.model + ' model not found in application';
                            mLog = {'logType': 'FATAL', 'model': value.model, 'dbVersion': dbVersion, 'filePath': filePath,
                                'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': msg}};
                            err = new Error(msg);
                            err.mLog = mLog;
                            return asyncCb(err);
                        }
                        if (value.skipValidation === true) {
                            // eslint-disable-next-line no-console
                            console.log('Skipping validations for model ' + value.model + ' (tenant ' + value.ctxId + ')');
                            /* istanbul ignore else */
                            if (!validationFunctions[value.model]) {
                                validationFunctions[value.model] = model.prototype.isValid;
                                model.prototype.isValid = function (done) {
                                    done(true);
                                };
                            }
                        } else if (validationFunctions[value.model]) {
                            model.prototype.isValid = validationFunctions[value.model];
                            delete validationFunctions[value.model];
                            // eslint-disable-next-line no-console
                            console.log('Restoring validation for model ' + value.model + ' (tenant ' + value.ctxId + ')');
                        }
                    }
                    var dataList;
                    try {
                        dataList = require(filePath);
                    } catch (e) {
                        if (e.code && e.code === 'MODULE_NOT_FOUND') {msg = 'File ' + filePath + ' not found. Either add the file or change meta.json at ' + metaPath;} else msg = e.message;
                        mLog = {'logType': 'ERROR', 'model': value.model, 'dbVersion': dbVersion, 'filePath': null,
                            'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': msg }};
                        err = new Error(msg);
                        err.mLog = mLog;
                        return asyncCb(err);
                    }

                    if (Object.prototype.toString.call(dataList) === '[object Object]') {
                        dataList = [dataList];
                    }
                    if (Object.prototype.toString.call(dataList) === '[object Function]') {
                        dataList(opts, function (err) {
                            if (err) {
                                // eslint-disable-next-line no-console
                                console.error(err.message || err);
                                logMigration({'logType': 'ERROR', 'model': null, 'dbVersion': dbVersion, 'filePath': filePath,
                                    'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': err.message}});
                                return asyncCb(err);
                            }
                            // eslint-disable-next-line no-console
                            console.log('Executed script ' + filePath + ' for tenant ' + value.ctxId);

                            logMigration({'logType': 'INFO', 'model': null, 'dbVersion': dbVersion, 'filePath': filePath,
                                'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': {filePath: filePath}}});
                            return asyncCb();
                        });
                        return;
                    }
                    var success = 0;
                    var failed = 0;
                    async.eachSeries(dataList, function (data, asyncCb2) {
                        var localOptions = opts;
                        var key = value.key || 'id';
                        var filter = { where: {} };
                        filter.where[key] = data[key];
                        if (!data[key] && value.updateAttributes === true) {
                            var msg = 'updateAttributes is specified  in ' + metaPath + ' for ctxId ' + value.ctxId + ' and model ' + value.model + ', but key is not specified. Alternatively, add id for data in ' + filePath;
                            // eslint-disable-next-line no-console
                            console.error(msg);
                            logMigration({'logType': 'ERROR', 'model': value.model, 'dbVersion': dbVersion, 'filePath': filePath,
                                'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': msg}});
                            return asyncCb(new Error(msg));
                        }
                        if (data[key]) {
                            model.find(filter, localOptions, function (err, dbData) {
                                /* istanbul ignore if */
                                if (err) {
                                    logMigration({'logType': 'WARN', 'model': value.model, 'dbVersion': dbVersion, 'filePath': filePath,
                                        'migrationDate': new Date(), 'tenant': value && value.ctxId ? value.ctxId : null, 'log': {'message': err.message, 'data': data}});
                                    return asyncCb2();
                                }
                                if (dbData.length) {
                                    data.id = dbData[0].id;
                                    if (dbData[0]._version) {
                                        data._version = dbData[0]._version;
                                    }
                                }
                                if (value.updateAttributes === true) {
                                    /* istanbul ignore else */
                                    if (!dbData[0]) {
                                        var msg = 'updateAttributes is specified, but there is no data present in DB for ' + JSON.stringify(value);
                                        // eslint-disable-next-line no-console
                                        console.error(msg);
                                        logMigration({'logType': 'ERROR', 'model': value.model, 'dbVersion': dbVersion, 'filePath': filePath,
                                            'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': msg, 'data': data}});
                                        return asyncCb2(new Error(msg));
                                    }
                                    dbData[0].updateAttributes(data, localOptions, function (err, mData) {
                                        /* istanbul ignore if */
                                        if (err) {
                                            failed++;
                                            logMigration({'logType': 'WARN', 'model': value.model, 'dbVersion': dbVersion, 'filePath': filePath,
                                                'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': err.message, 'data': data}});
                                        } else success++;
                                        return asyncCb2();
                                    });
                                } else if (dbData.length) {
                                    model.upsert(data, localOptions, function (err, mData) {
                                        /* istanbul ignore if */
                                        if (err) {
                                            failed++;
                                            logMigration({'logType': 'WARN', 'model': value.model, 'dbVersion': dbVersion, 'filePath': filePath,
                                                'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': err.message, 'data': data}});
                                        } else success++;
                                        return asyncCb2();
                                    });
                                } else {
                                    model.create(data, localOptions, function (err, mData) {
                                        /* istanbul ignore if */
                                        if (err) {
                                            failed++;
                                            logMigration({'logType': 'WARN', 'model': value.model, 'dbVersion': dbVersion, 'filePath': filePath,
                                                'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': err.message, 'data': data}});
                                        } else success++;
                                        return asyncCb2();
                                    });
                                }
                            });
                        } else {
                            model.upsert(data, localOptions, function (err, mData) {
                                if (err) {
                                    failed++;
                                    logMigration({'logType': 'WARN', 'model': value.model, 'dbVersion': dbVersion, 'filePath': filePath,
                                        'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': err.message, 'data': data}});
                                } else success++;
                                return asyncCb2();
                            });
                        }
                    }, function (err) {
                        if (err) {
                            // eslint-disable-next-line no-console
                            console.error(err.message || err);
                            logMigration({'logType': 'ERROR', 'model': null, 'dbVersion': dbVersion, 'filePath': filePath,
                                'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': err.message}});
                            return asyncCb(err);
                        }
                        // eslint-disable-next-line no-console
                        console.log('Migrated ' + dataList.length + ' records to table ' + value.model + ' for tenant ' + value.ctxId + ' with ' + success + ' succeeding and ' + failed + ' failing, from ' + filePath);

                        logMigration({'logType': 'INFO', 'model': value.model, 'dbVersion': dbVersion, 'filePath': filePath,
                            'migrationDate': new Date(), 'tenant': value.ctxId, 'log': {'message': {total: dataList.length, success: success, failed: failed}}});
                        return asyncCb();
                    });
                }
            }, function (err) {
                if (err) {
                    logMigration(err.mLog ? err.mLog : {'logType': 'ERROR', 'model': null, 'dbVersion': dbVersion, 'filePath': null,
                        'migrationDate': new Date(), 'tenant': null, 'log': {'message': err.message}});
                }
                cb(err);
            });
        }
    } else {
        logMigration({'logType': 'ERROR', 'model': null, 'dbVersion': dbVersion, 'filePath': null,
            'migrationDate': new Date(), 'tenant': null, 'log': {'message': 'The meta.json file was not found at ' + metaPath}});
        cb(new Error('file not found ' + metaPath));
    }
}


function clearTable(table, cb) {
    var mdl = loopback.findModel(table);
    if (mdl) {
        mdl.remove({}, opts, function (err, data) {
            /* istanbul ignore if */
            if (err) {
                cb(err);
            } else {
                // eslint-disable-next-line no-console
                console.log('Deleted ' + (data && data.count) + ' records from table ' + table);
                cb();
            }
        });
    } else {
        var msg = 'Model not found for table ' + table + '. Skipping clearing of this table. Nothing migrated';
        var err = new Error(msg);
        cb(err);
    }
}


function getListOfMigrationPaths(options, cb) {
    basePath = (options && options.basePath) || basePath;
    moduleName = (options && options.moduleName) || './';
    var versionKey = 'dbVersion.' + moduleName;
    var pathErrors = [];
    if (!(fs.existsSync(basePath) && fs.lstatSync(basePath).isDirectory())) {
        return cb(new Error('Path ' + basePath + ' does not exist. Not migrating.'), null);
    }
    var SystemConfig = loopback.findModel('SystemConfig');
    SystemConfig.findOne({
        where: {
            key: versionKey
        }
    }, opts, function (err, dbVersionInstance) {
        var fromVersion;
        var toVersion;
        /* istanbul ignore if */
        if (err) {
            return cb(err, null);
        }
        var dbVersion = dbVersionInstance ? dbVersionInstance.value : null;
        if (options && options.fromVersion) fromVersion = options.fromVersion;
        if (options && options.toVersion) toVersion = options.toVersion;
        var migDirs = [];
        var retList = [];

        var allSubDirs = fs.readdirSync(basePath);
        allSubDirs.forEach(function (subDir) {
            if (!semver.valid(subDir)) {
                /* istanbul ignore else */
                if (options.verbose) {
                    var msg = subDir + ' is not a valid semver. The contents of this folder (' + path.join(basePath, subDir) + ') will not be migrated.';
                    warnings.push(msg);
                    // eslint-disable-next-line no-console
                    console.warn(msg);
                }
                logMigration({'logType': 'WARN', 'model': null, 'dbVersion': subDir, 'filePath': null,
                    'migrationDate': new Date(), 'tenant': null, 'log': {'message': subDir + ' is not a valid semver. The contents of this folder (' + path.join(basePath, subDir) + ') will not be migrated.'}});
                pathErrors.push(new Error(subDir + ' at ' + path.join(basePath, subDir) + ' is not a valid semver.'));
                return;
            }
            if (options && options.force === true) {
                /* istanbul ignore else */
                if (fromVersion && semver.lt(subDir, fromVersion)) return;
                if (toVersion && semver.gt(subDir, toVersion)) return;
            } else
            /* istanbul ignore else */
            if (dbVersion && semver.lte(subDir, dbVersion)) return;
            migDirs.push(subDir);
        });
        migDirs.sort(function migDirsSortFn(a, b) {
            return (semver.gt(a, b) ? 1 : -1);
        });
        if (migDirs.length) {
            retList = migDirs.map(subDir => (path.join(basePath, subDir)));
        }
        if (pathErrors.length > 0) {
            return cb(new Error(JSON.stringify(pathErrors.map(function (e) {return e.message;}))), {
                migratedVersions: migDirs,
                migrationDirs: retList,
                dbVersionInstance: dbVersionInstance
            });
        }
        cb(null, {
            migratedVersions: migDirs,
            migrationDirs: retList,
            dbVersionInstance: dbVersionInstance
        });
    });
}


function logMigration(data) {
    MigrationLog.create(data, opts, function (err, data) {
    /* istanbul ignore if */
        if (err) {
            // eslint-disable-next-line no-console
            console.log(err);
        }
    });
}


function exportTableDataToFolder(options, finalCb) {
    var startTime;
    var endTime;
    function cb(err, data) {
        if (err) {
            // eslint-disable-next-line no-console
            console.error(err.message);
        }
        if (data && data.message) {
            // eslint-disable-next-line no-console
            console.log(data.message + ' with exportVersion ' + data.exportVersion);
        }
        endTime = new Date().getTime();
        // eslint-disable-next-line no-console
        console.log('Export took ' + (endTime - startTime) / 1000 + ' sec');
        // eslint-disable-next-line no-console
        console.log('Export of tables to folder ended at ' + new Date());
        // eslint-disable-next-line no-console
        console.log('***********************************************************************\n\n');
        if (data && warnings.length > 0) data.warnings = warnings;
        finalCb(err, data);
    }

    // eslint-disable-next-line no-console
    console.log('\n\n***********************************************************************');
    // eslint-disable-next-line no-console
    console.log('Starting Export of tables to folder at ' + new Date());
    startTime = new Date().getTime();

    // eslint-disable-next-line no-console
    console.log('Export Options: ' + JSON.stringify(options));
    var tableList = [];
    if (options.exportAllTables === true) {
        tableList = require('oe-cloud').models().filter(function (m) {
            var validModel = m && m.modelName && m.settings;
            var isFrameworkModel = m && m.modelName && m.settings && m.settings.isFrameworkModel;
            var excludeFrameworkTables = options.excludeFrameworkTables;

            if (validModel && ['SystemConfig', 'MigrationLog'].indexOf(m.modelName) > -1) return false;
            if (validModel && options.excludeTables && options.excludeTables.length > 0 && options.excludeTables.indexOf(m.modelName) > -1) return false;

            if (validModel) {
                if (isFrameworkModel) {
                    if (excludeFrameworkTables) return false;
                    return true;
                } return true;
            } return false;
        }).map(function (m) { return m.modelName; });
    }
    if (options.tableList && options.tableList.length > 0) {
        options.tableList = options.tableList.filter(function (elem, pos) {
            return options.tableList.indexOf(elem) === pos;
        });

        options.tableList.forEach(function (t) {
            if (tableList.indexOf(t) === -1) tableList.push(t);
            else {
                var msg = 'Ignoring duplicate specified in tableList: ' + t;
                warnings.push(msg);
                // eslint-disable-next-line no-console
                console.warn(msg);
            }
        });
    }
    if (tableList.length === 0) return cb(new Error('Either exportAllTables should be set to true or/and tableList must be a string array of table names, containing at least one table name'), null);

    if (!options.exportPath) options.exportPath = path.resolve(process.cwd(), typeof global.it !== 'function' ? '' : 'test', 'export');
    if (!fs.existsSync(options.exportPath)) {
        try {
            fs.mkdirSync(options.exportPath);
            // eslint-disable-next-line no-console
            console.log('Created folder ' + options.exportPath);
        } catch (e) {
            return cb(e, null);
        }
    }
    var exportDirs = [];
    var nextSubDir;
    var tenant;
    var remoteUser;
    var metaPath;
    var metaData;
    var allSubDirs = fs.readdirSync(options.exportPath);
    allSubDirs.forEach(function (subDir) {
        if (!semver.valid(subDir)) {
            return;
        }
        exportDirs.push(subDir);
    });
    exportDirs.sort(function (a, b) {
        return (semver.gt(a, b) ? 1 : -1);
    });
    var latestSubDir = exportDirs[exportDirs.length - 1];
    if (options.exportVersion) nextSubDir  = options.exportVersion;
    else if (!latestSubDir) nextSubDir  = '1.0.0';
    else nextSubDir  = semver.inc(latestSubDir, 'minor');
    try {
        fs.mkdirSync(path.join(options.exportPath, nextSubDir));
        // eslint-disable-next-line no-console
        console.log('Created folder ' + path.join(options.exportPath, nextSubDir));
    } catch (e) {
        return cb(e, null);
    }
    tenant = options.tenant || 'default';
    if (options.includeAutoScope === true) tenant = 'autoscope';
    remoteUser = options.remoteUser || 'defaultuser';
    try {
        fs.mkdirSync(path.join(options.exportPath, nextSubDir, tenant));
        // eslint-disable-next-line no-console
        console.log('Created folder ' + path.join(options.exportPath, nextSubDir, tenant));
    } catch (e) {
        return cb(e, null);
    }

    metaPath = path.join(options.exportPath, nextSubDir, 'meta.json');
    metaData = { 'contexts': {} };
    metaData.contexts[tenant] = {
        'id': 0,
        'tenantId': tenant,
        'remoteUser': remoteUser
    };
    try {
        fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 4));
    } catch (e) {
        return cb(e);
    }


    async.eachSeries(tableList, checkForModel, checkForModelsCb);

    function checkForModel(tableName, localCb) {
        var model = loopback.findModel(tableName);
        if (!model) {
            if (options.strict === true) {return localCb(new Error('Table ' + tableName + ' specified in tableList does not have a corresponding Model in the application. Use strict = false to ignore and proceed.'));}
            var msg = 'Table ' + tableName + ' specified in tableList does not have a corresponding Model in the application. Proceeding with remaining tables. Use strict = true to stop export in such cases.';
            warnings.push(msg);
            // eslint-disable-next-line no-console
            console.warn(msg);
        }
        localCb();
    }
    function checkForModelsCb(err) {
        if (err) {
            cb(err, null);
        } else {
            exportTables(options);
        }
    }


    function exportTables(options) {
        var exportedTables = [];
        async.eachSeries(tableList, exportTable, exportTablesCb);

        function exportTable(tableName, localCb) {
            var model = loopback.findModel(tableName);
            if (model) {
                exportedTables.push(tableName);
                model.find({}, opts, function (err, data) {
                    /* istanbul ignore if */
                    if (err) {
                        if (options.strict === true) {return localCb(err);}
                        var msg = err.message + ' Proceeding with remaining tables. Use strict = true to stop export in such cases.';
                        warnings.push(msg);
                        // eslint-disable-next-line no-console
                        console.warn(msg);
                        localCb();
                    } else {
                        var fileName = path.join(options.exportPath, nextSubDir, tenant, tableName + '.json');
                        var dataIncludingAutoScope;
                        if (options.includeAutoScope === true) {
                            data.forEach(function (d) {
                                if (!dataIncludingAutoScope) dataIncludingAutoScope = [];
                                dataIncludingAutoScope.push(d.__data);
                            });
                        }

                        fs.writeFile(fileName, JSON.stringify(dataIncludingAutoScope || data, null, 4), function (err) {
                            /* istanbul ignore if */
                            if (err) {
                                if (options.strict === true) {return localCb(err);}
                                var msg = err.message + ' Proceeding with remaining tables. Use strict = true to stop export in such cases.';
                                warnings.push(msg);
                                // eslint-disable-next-line no-console
                                console.warn(msg);
                                localCb();
                            } else {
                                // eslint-disable-next-line no-console
                                console.log('Wrote ' + tableName + ' data to file ' + fileName);
                                if (!metaData.files) metaData.files = [];
                                metaData.files.push({
                                    'model': tableName,
                                    'enabled': true,
                                    'file': path.join(tenant, tableName + '.json'),
                                    'ctxId': tenant
                                });
                                try {
                                    fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 4));
                                } catch (e) {
                                    return cb(e);
                                }
                                localCb();
                            }
                        });
                    }
                });
            } else {
                localCb();
            }
        }
        function exportTablesCb(err) {
            if (err) cb(err, null);
            else {
                var msg = 'Export completed for tables ' + JSON.stringify(exportedTables);
                cb(null, {message: msg, metaData: metaData, exportVersion: nextSubDir});
            }
        }
    }
}


function prepareTable(tableName, cb) {
    var exportPath = path.resolve(process.cwd(), typeof global.it !== 'function' ? '' : 'test', 'tmp');
    if (fs.existsSync(exportPath)) deleteFolderRecursive(exportPath);
    fs.mkdirSync(exportPath);
    var options = {tableList: [tableName], exportPath: exportPath, includeAutoScope: true};
    exportTableDataToFolder(options, function (err, data) {
        if (err) cb(err);
        else {
            clearTable(tableName, function (err) {
                cb(err);
            });
        }
    });
}


function deleteFolderRecursive(pathToDelete) {
    if (fs.existsSync(pathToDelete)) {
        fs.readdirSync(pathToDelete).forEach(function (file, index) {
            var curPath = path.resolve(pathToDelete, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        try {
            fs.rmdirSync(pathToDelete);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn(e.message);
        }
    }
}


function restoreTableData(tableName, cb) {
    var data;
    var dataFilePath = path.resolve(process.cwd(), typeof global.it !== 'function' ? '' : 'test', 'tmp', '1.0.0', 'autoscope',  tableName + '.json' );
    /* istanbul ignore else */
    if (fs.existsSync(dataFilePath)) {
        data = require(dataFilePath);
        var model = loopback.findModel(tableName);
        /* istanbul ignore else */
        if (model) {
            var opts = {
                ignoreAutoScope: true,
                fetchAllScopes: true
            };
            model.create(data, opts, function (err, data) {
                /* istanbul ignore if */
                if (err) {
                    return cb(err);
                }
                cb();
            });
        } else {
            cb(new Error('Model ' + tableName + ' not found'));
        }
    } else {
        cb(new Error('Model data for ' + tableName + ' not found'));
    }
}


module.exports = {
    migrate: migrate,
    getBasePath: getBasePath,
    setBasePath: setBasePath,
    exportTableDataToFolder: exportTableDataToFolder
};
