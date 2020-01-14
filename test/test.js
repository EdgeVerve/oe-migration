/*
©2015-2016 EdgeVerve Systems Limited (a fully owned Infosys subsidiary), Bangalore, India. All Rights Reserved.
The EdgeVerve proprietary software program ("Program"), is protected by copyrights laws, international treaties and other pending or existing intellectual property rights in India, the United States and other countries.
The Program may contain/reference third party or open source components, the rights to which continue to remain with the applicable third party licensors or the open source community as the case may be and nothing here transfers the rights to the third party and open source components, except as expressly permitted.
Any unauthorized reproduction, storage, transmission in any form or by any means (including without limitation to electronic, mechanical, printing, photocopying, recording or  otherwise), or any distribution of this Program, or any portion of it, may result in severe civil and criminal penalties, and will be prosecuted to the maximum extent possible under the law.
*/
/**
 *
 * This is a mocha test script for the oe-migration app-list module for oe-Cloud
 * based applications.
 *
 * @file test.js
 * @author Ajith Vasudevan
 */

var app = require('oe-cloud');
var loopback = require('loopback');
var log = require('oe-logger')('migrationTest');
var chalk = require('chalk');
var chai = require('chai');
var async = require('async');
chai.use(require('chai-things'));
var expect = chai.expect;
var defaults = require('superagent-defaults');
var supertest = require('supertest');
var api = defaults(supertest(app));
var fs = require('fs');
var path = require('path');
var migration = require('..');
var restBasePath;
// Boot the application instance
app.boot(__dirname, function (err) {
    if (err) {
        console.log(chalk.red(err));
        log.error(err);
        process.exit(1);
    }
    app.start();
    app.emit('test-start');
});

var opts, baseURL, MigrationLog, MigrationTest1, MigrationTest2, SystemConfig, basePath;

// Test case code begins here:
describe(chalk.blue('oe-migration tests'), function (done) {
    var TAG = 'describe()';
    log.debug('Starting oe-migration tests');

    this.timeout(600000); // setting the timeout to 10 minutes so as to be able to keep running
    // the application for as long as required to do all  tests


    // The param function of before() is called before everything else in the test-case.
    // The param function's callback (done) is called to signal that the test-case can
    // proceed to the next step.
    // In the param function, we subscribe to the app's 'test-start' event. We do some
    // initial setup and call done() from within this event's callback so as to make sure
    // the initial setup is performed after all the boot scripts have run, and we proceed to the
    // next step in the test only after the initial setup is done.
    before('wait for boot scripts to complete', function (done) {
        var TAG = 'before()';
        log.debug('Starting ' + TAG);
        restBasePath = app.get('restApiRoot');
        // The 'test-start' event is fired after boot of app. In its callback,
        // we perform some initial setup for our tests, like
        // clearing any existing test data.
        app.on('test-start', function () {
            var TAG = "'test-start' event callback";
            log.debug('Starting ' + TAG);

            // Initial Setup begins here:
            // initialize variables
            opts = {
                ignoreAutoScope: true,
                fetchAllScopes: true
            };
            MigrationLog = loopback.getModelByType('MigrationLog');
            MigrationTest1 = loopback.getModelByType('MigrationTest1');
            MigrationTest2 = loopback.getModelByType('MigrationTest2');
            SystemConfig = loopback.getModelByType('SystemConfig');
            baseURL = app.get('restApiRoot');
            basePath = migration.getBasePath();
            clearTestData(function (err) {
                if (err) return done(err);

                deleteMigrationLog(function (err) {
                    if (err) return done(err);

                    clearMigrationTestTables(function (err) {
                        if (err) done(err);
                        else {
                            createTestData(basePath, function (err) {
                                done(err);
                            });
                        }
                    });
                });
            });
        });
    });


    // This Mocha function is called after all 'it()' tests are run
    // We do some cleanup here
    after('after all', function (done) {
        var TAG = 'after()';
        console.log(chalk.yellow('Starting ' + TAG));
        log.debug(TAG, 'After all tests');
        clearTestData(function (err) {
            done();
            setTimeout(function () {
                process.exit(0);
            }, 3000);
        });
    });


    // This function deletes all records in the MasterJobExecutorTestData table
    function clearTestData(cb) {
        var TAG = 'clearTestData:';
        SystemConfig.remove({ }, opts, function findCb(err, res) {
            if (err) {
                console.error(TAG, 'Could not remove dbVersion record from SystemConfig ' + JSON.stringify(err));
                cb(err);
            } else {
                console.log(TAG, 'deleted ' + res.count + ' SystemConfig records');
                deleteFolderRecursive(basePath);
                console.log(TAG, 'deleted test/db folder');
                deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'export'));
                console.log(TAG, 'deleted test/export folder');
                cb();
            }
        });
    }

    function deleteMigrationLog(cb) {
        var TAG = 'deleteMigrationLog:';
        MigrationLog.remove({}, opts, function findCb(err, res) {
            if (err) {
                console.error(TAG, 'Could not remove MigrationLog records ' + JSON.stringify(err));
                cb(err);
            } else {
                console.log(TAG, 'deleted ' + res.count + ' MigrationLog records');
                cb();
            }
        });
    }


    function clearMigrationTestTables(cb) {
        var TAG = 'clearMigrationTestTables:';
        MigrationTest1.remove({}, opts, function findCb(err, res) {
            if (err) {
                console.error(TAG, 'Could not remove MigrationTest1 records ' + JSON.stringify(err));
                cb(err);
            } else {
                console.log(TAG, 'deleted ' + res.count + ' MigrationTest1 records');
                MigrationTest2.remove({}, opts, function findCb(err, res) {
                    if (err) {
                        console.error(TAG, 'Could not remove MigrationTest2 records ' + JSON.stringify(err));
                        cb(err);
                    } else {
                        console.log(TAG, 'deleted ' + res.count + ' MigrationTest2 records');
                        cb();
                    }
                });
            }
        });
    }


    function createTestData(basePath, cb) {
        var TAG = 'createTestData:';
        try {
            fs.mkdirSync(basePath);
            copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '1.0.0'), path.join(basePath, '1.0.0'));
            copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '1.0.1'), path.join(basePath, '1.0.1'));
            copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '2.0.0'), path.join(basePath, '2.0.0'));
            copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '2.5.0'), path.join(basePath, '2.5.0'));
            console.log(TAG, 'copied test data [1.0.0, 1.0.1, 2.0.0, 2.5.0]');
            cb();
        } catch (e) {
            cb(e);
        }
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
                console.warn(e.message);
            }
        }
    }

    function copyRecursiveSync(src, dest) {
        var exists = fs.existsSync(src);
        var stats = exists && fs.statSync(src);
        var isDirectory = exists && stats.isDirectory();
        if (exists && isDirectory) {
            try {fs.mkdirSync(dest); } catch (e) {}
            fs.readdirSync(src).forEach(function (childItemName) {
                copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
            });
        } else {
            fs.linkSync(src, dest);
        }
    }


    /**
     * This test checks for error when the MasterJobExecutor is started without options
     */
    it('should test migration and migrated versions returned should be 1.0.0, 1.0.1, 2.0.0, 2.5.0', function (done) {
        var TAG = '[should test migration and migrated versions returned should be 1.0.0, 1.0.1, 2.0.0, 2.5.0]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var options = {verbose: true};
        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(oldDbVersion).to.be.null;
            expect(data.migratedVersions).to.eql(['1.0.0', '1.0.1', '2.0.0', '2.5.0']);
            done();
        });
    });

    it('should test migration again and err should not be null and have proper message', function (done) {
        var TAG = '[should test migration again and err should not be null and have proper message]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};
        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).to.be.null;
            expect(oldDbVersion).to.equal('2.5.0');
            expect(data.migratedVersions).to.be.null;
            done();
        });
    });


    it('should test migration with force option and migrated versions returned should be 1.0.0, 1.0.1, 2.0.0, 2.5.0', function (done) {
        var TAG = '[should test migration with force option and migrated versions returned should be 1.0.0, 1.0.1, 2.0.0, 2.5.0]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {
            force: true
        };
        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).to.be.null;
            expect(oldDbVersion).to.equal('2.5.0');
            expect(data.migratedVersions).to.eql(['1.0.0', '1.0.1', '2.0.0', '2.5.0']);
            done();
        });
    });


    it('should test migration with force option and afterVersion and migrated versions returned should be 2.0.0, 2.5.0', function (done) {
        var TAG = '[should test migration with force option and afterVersion and migrated versions returned should be 2.0.0, 2.5.0]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {
            force: true,
            fromVersion: '2.0.0'
        };
        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).to.be.null;
            expect(oldDbVersion).to.equal('2.5.0');
            expect(data.migratedVersions).to.eql(['2.0.0', '2.5.0']);
            done();
        });
    });


    it('should test migration with force option, afterVersion, toVersion and migrated versions returned should be 1.0.1, 2.0.0', function (done) {
        var TAG = '[should test migration with force option, afterVersion, toVersion and migrated versions returned should be 1.0.1, 2.0.0]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {
            force: true,
            fromVersion: '1.0.1',
            toVersion: '2.0.0'
        };
        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).to.be.null;
            expect(oldDbVersion).to.equal('2.5.0');
            expect(data.migratedVersions).to.eql(['1.0.1', '2.0.0']);
            done();
        });
    });

    it('should test migration again and err should be null and and updated migrated versions returned should be 2.5.0', function (done) {
        var TAG = '[should test migration again and err should be null and and updated migrated versions returned should be 2.5.0]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};
        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).to.be.null;
            expect(oldDbVersion).to.equal('2.0.0');
            expect(data.migratedVersions).to.eql(['2.5.0']);
            done();
        });
    });


    it('should test migration again and err should not be null and have proper message', function (done) {
        var TAG = '[should test migration again and err should not be null and have proper message]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};
        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).to.be.null;
            expect(data.migratedVersions).to.be.null;
            expect(oldDbVersion).to.equal('2.5.0');
            done();
        });
    });


    it('should add new versions of data and perform migration and err should be null and migrated versions should be 3.0.0, 3.2.0', function (done) {
        var TAG = '[should add new versions of data and perform migration and err should be null and migrated versions should be 3.0.0, 3.2.0]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '3.0.0'), path.join(basePath, '3.0.0'));
        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '3.2.0'), path.join(basePath, '3.2.0'));
        console.log('copied more test data [3.0.0, 3.2.0]');

        deleteMigrationLog(cb);
        function cb() {
            migration.migrate(options, function (err, oldDbVersion, data) {
                expect(err).to.be.null;
                expect(oldDbVersion).to.equal('2.5.0');
                expect(data.migratedVersions).to.eql(['3.0.0', '3.2.0']);
                var MigrationLog = loopback.findModel('MigrationLog');
                console.log('MigrationLog follows:');
                MigrationLog.find({}, opts, function (err, data) {
                    if (data) {
                        data.forEach(function (d) {
                            console.dir(JSON.stringify(d, null, 4));
                        });
                    }
                    done();
                });
            });
        }
    });


    it('should add new versions of data with updateAttributes = true and perform migration and err should not be null and migrated versions should be [3.3.0]', function (done) {
        var TAG = '[should add new versions of data with updateAttributes = true and perform migration and err should not be null and migrated versions should be [3.3.0]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '3.3.0'), path.join(basePath, '3.3.0'));

        console.log('copied more test data [3.3.0]');

        deleteMigrationLog(cb);
        function cb() {
            migration.migrate(options, function (err, oldDbVersion, data) {
                expect(err).to.be.null;
                expect(oldDbVersion).to.equal('3.2.0');
                expect(data.migratedVersions).to.eql(['3.3.0']);
                done();
            });
        }
    });


    it('should clear table and add new versions of data with updateAttributes = true and perform migration and expected err should be thrown', function (done) {
        var TAG = '[should clear table and add new versions of data with updateAttributes = true and perform migration and expected err should be thrown';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '3.3.1'), path.join(basePath, '3.3.1'));

        console.log('copied more test data [3.3.1]');
        clearMigrationTestTables(cb);
        function cb() {
            migration.migrate(options, function (err, oldDbVersion, data) {
                expect(err).not.to.be.null;
                expect(err.message).to.contain('updateAttributes is specified, but there is no data present in DB');
                expect(oldDbVersion).to.equal('3.3.0');
                expect(data.migratedVersions).to.be.null;
                deleteFolderRecursive(path.join(basePath, '3.3.1'));
                done();
            });
        }
    });


    it('should add new versions of data without id field and with updateAttributes = true and perform migration and expected error should be thrown', function (done) {
        var TAG = '[should add new versions of data without id field and with updateAttributes = true and perform migration and expected error should be thrown]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '3.4.0'), path.join(basePath, '3.4.0'));

        console.log('copied more test data [3.4.0]');

        deleteMigrationLog(cb);
        function cb() {
            migration.migrate(options, function (err, oldDbVersion, data) {
                expect(err).not.to.be.null;
                expect(err.message).to.contain('updateAttributes is specified');
                expect(err.message).to.contain('but key is not specified. Alternatively, add id for data in');
                expect(oldDbVersion).to.equal('3.3.0');
                expect(data.migratedVersions).to.be.null;
                deleteFolderRecursive(path.join(basePath, '3.4.0'));
                done();
            });
        }
    });


    it('should add new invalid semver and perform migration and err should not be null and have proper message', function (done) {
        var TAG = '[should add new invalid semver and perform migration and err should not be null and have proper message]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {verbose: true};

        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '4.0'), path.join(basePath, '4.0'));
        console.log('copied more test data [4.0]');

        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).not.to.be.null;
            expect(oldDbVersion).to.equal('3.3.0');
            expect(data.migratedVersions).to.be.null;
            expect(err.message).to.contain('4.0 is not a valid semver');
            done();
        });
    });


    it('should add new empty, but valid data folders and perform migration and it should return expected error', function (done) {
        var TAG = '[should add new empty, but valid data folders and perform migration and it should return expected error]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        deleteFolderRecursive(path.join(process.cwd(), 'test', 'db', '4.0'));
        fs.mkdirSync(path.join(basePath, '5.0.0'));
        fs.mkdirSync(path.join(basePath, '6.0.0'));

        console.log('createdd empty test data folders [5.0.0, 6.0.0]');

        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).not.to.be.null;
            expect(oldDbVersion).to.equal('3.3.0');
            expect(data.migratedVersions).to.be.null;
            expect(err.message).to.contain('file not found');
            expect(err.message).to.contain(path.join('db', '5.0.0', 'meta.json'));
            done();
        });
    });


    it('should return expected error if a meta.json is malformed', function (done) {
        var TAG = '[should return expected error if a meta.json is malformed]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        deleteFolderRecursive(path.join(process.cwd(), 'test', 'db', '5.0.0'));
        deleteFolderRecursive(path.join(process.cwd(), 'test', 'db', '6.0.0'));
        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '7.0.0'), path.join(basePath, '7.0.0'));

        console.log('copied more test data [7.0.0]');

        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).not.to.be.null;
            expect(oldDbVersion).to.equal('3.3.0');
            expect(data.migratedVersions).to.be.null;
            expect(err.message).to.contain(path.join(process.cwd(), 'test', 'db', '7.0.0', 'meta.json') + ': Unexpected token');
            done();
        });
    });


    it('should return expected error message with missing data file', function (done) {
        var TAG = '[should return expected error message with missing data file]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        deleteFolderRecursive(path.join(process.cwd(), 'test', 'db', '7.0.0'));
        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '8.0.0'), path.join(basePath, '8.0.0'));

        console.log('copied more test data [8.0.0]');

        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).not.to.be.null;
            expect(oldDbVersion).to.equal('3.3.0');
            expect(data.migratedVersions).to.be.null;
            expect(err.message).to.contain('migration-test1.json not found');
            done();
        });
    });

    it('should return expected error message with missing ctxId in meta.json', function (done) {
        var TAG = '[should return expected error message with missing ctxId in meta.json]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        deleteFolderRecursive(path.join(process.cwd(), 'test', 'db', '8.0.0'));
        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '9.0.0'), path.join(basePath, '9.0.0'));

        console.log('copied more test data [9.0.0]');

        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).not.to.be.null;
            expect(oldDbVersion).to.equal('3.3.0');
            expect(data.migratedVersions).to.be.null;
            expect(err.message).to.contain('ctxId \'/default/tenant1\' not found in contexts of');
            expect(err.message).to.contain(path.join('test', 'db', '9.0.0', 'meta.json'));
            done();
        });
    });

    it('should return expected error message with missing model', function (done) {
        var TAG = '[should return expected error message with missing model]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        deleteFolderRecursive(path.join(process.cwd(), 'test', 'db', '9.0.0'));
        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '10.0.0'), path.join(basePath, '10.0.0'));

        console.log('copied more test data [10.0.0]');

        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).not.to.be.null;
            expect(oldDbVersion).to.equal('3.3.0');
            expect(data.migratedVersions).to.be.null;
            expect(err.message).to.contain('MigrationTest3 model not found in application');
            done();
        });
    });

    it('should return expected error message with malformed data file', function (done) {
        var TAG = '[should return expected error message with malformed data file]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        deleteFolderRecursive(path.join(process.cwd(), 'test', 'db', '10.0.0'));
        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '11.0.0'), path.join(basePath, '11.0.0'));

        console.log('copied more test data [11.0.0]');

        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).not.to.be.null;
            expect(oldDbVersion).to.equal('3.3.0');
            expect(data.migratedVersions).to.be.null;
            expect(err.message).to.contain('migration-test1.json: Unexpected token');
            done();
        });
    });

    it('should return expected error message with missing context key in meta.json', function (done) {
        var TAG = '[should return expected error message with missing context key in meta.json]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        deleteFolderRecursive(path.join(process.cwd(), 'test', 'db', '11.0.0'));
        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '12.0.0'), path.join(basePath, '12.0.0'));

        console.log('copied more test data [12.0.0]');

        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).not.to.be.null;
            expect(oldDbVersion).to.equal('3.3.0');
            expect(data.migratedVersions).to.be.null;
            expect(err.message).to.contain('ctxId \'default\' not found in contexts of');
            expect(err.message).to.contain(path.join('test', 'db', '12.0.0', 'meta.json'));
            done();
        });
    });

    it('should return no error when migrating with missing files key in meta.json', function (done) {
        var TAG = '[should return no error when migrating with missing files key in meta.json]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        deleteFolderRecursive(path.join(process.cwd(), 'test', 'db', '12.0.0'));
        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '13.0.0'), path.join(basePath, '13.0.0'));

        console.log('copied more test data [13.0.0]');

        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).to.be.null;
            expect(oldDbVersion).to.equal('3.3.0');
            expect(data.migratedVersions).to.eql(['13.0.0']);
            done();
        });
    });


    it('should return expected error when migrating with non-existent basePath', function (done) {
        var TAG = '[should return expected error when migrating with non-existent basePath]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        deleteFolderRecursive(path.join(process.cwd(), 'test', 'db', '13.0.0'));

        migration.setBasePath(path.resolve(process.cwd(), 'somefolder', 'that', 'does', 'not', 'exist'));
        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).not.to.be.null;
            expect(oldDbVersion).to.be.null;
            expect(data.migratedVersions).to.be.null;
            expect(err.message).to.contain(path.join('somefolder', 'that', 'does', 'not', 'exist') + ' does not exist');
            done();
        });
    });


    it('should test migration without options', function (done) {
        var TAG = '[should test migration without options]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        migration.setBasePath(null);  // Setting it back to default
        migration.migrate(function (err, oldDbVersion, data) {
            expect(err).to.be.null;
            expect(oldDbVersion).to.equal('13.0.0');
            expect(data.migratedVersions).to.be.null;
            done();
        });
    });

    it('should test migration without options and callback function', function (done) {
        var TAG = 'should test migration without options and callback function]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        migration.migrate();
        setTimeout(done, 1000);
    });

    it('should test migration with options and without callback function', function (done) {
        var TAG = '[should test migration with options and without callback function]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        migration.migrate({verbose: true});
        setTimeout(done, 1000);
    });

    it('should return expected error when clearTables in meta.json has invalid table name', function (done) {
        var TAG = '[should return expected error when clearTables in meta.json has invalid table name]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {};

        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '14.0.0'), path.join(basePath, '14.0.0'));

        console.log('test data [14.0.0]');

        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).not.to.be.null;
            expect(err.message).to.equal('Model not found for table MigrationTest3. Skipping clearing of this table. Nothing migrated');
            expect(oldDbVersion).to.equal('13.0.0');
            expect(data.migratedVersions).to.be.null;
            done();
        });
    });

    it('should test migration with validations skipped and validations restored and validations skipped again', function (done) {
        var TAG = '[should test migration with validations skipped and validations restored and validations skipped again]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        deleteFolderRecursive(path.join(process.cwd(), 'test', 'db', '14.0.0'));
        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '15.0.0'), path.join(basePath, '15.0.0'));

        var options = {verbose: true};

        deleteMigrationLog(cb);
        function cb() {
            migration.migrate(options, function (err, oldDbVersion, data) {
                expect(err).to.be.null;
                expect(oldDbVersion).to.equal('13.0.0');
                expect(data.migratedVersions).to.eql(['15.0.0']);
                done();
            });
        }
    });


    it('should export specified table data to a specified folder', function (done) {
        var TAG = 'should export specified table data to a specified folder]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var exportPath = path.resolve(process.cwd(), 'test', 'export');
        var options = {
            tableList: ['MigrationTest1', 'MigrationTest2'],
            exportPath: exportPath,
            exportVersion: '20.0.0',
            strict: true
        };

        deleteFolderRecursive(exportPath);

        migration.exportTableDataToFolder(options, function (err, data) {
            expect(err).to.be.null;
            expect(data).not.to.be.null;
            done();
        });
    });


    it('should test migration from the new export folder', function (done) {
        var TAG = '[should test migration from the new export folder]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var options = {verbose: true};

        migration.setBasePath(path.resolve(process.cwd(), 'test', 'export'));

        clearMigrationTestTables(function () {
            deleteMigrationLog(function () {
                migration.migrate(options, function (err, oldDbVersion, data) {
                    expect(oldDbVersion).to.equal('15.0.0');
                    expect(data.migratedVersions).to.eql(['20.0.0']);
                    done();
                });
            });
        });
    });


    it('should export specified table data to a specified folder with invalid tableList and strict = true', function (done) {
        var TAG = 'should export specified table data to a specified folder]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var exportPath = path.resolve(process.cwd(), 'test', 'export');
        var options = {
            tableList: ['MigrationTest1', 'Migrationtest2'],
            exportPath: exportPath,
            strict: true
        };

        deleteFolderRecursive(exportPath);

        migration.exportTableDataToFolder(options, function (err, data) {
            expect(err).not.to.be.null;
            expect(err.message).to.contain('Table Migrationtest2 specified in tableList does not have a corresponding Model in the application.');
            expect(data).to.be.null;
            done();
        });
    });

    it('should export specified table data to a specified folder with invalid tableList and strict = false', function (done) {
        var TAG = 'should export specified table data to a specified folder]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var exportPath = path.resolve(process.cwd(), 'test', 'export');
        var options = {
            tableList: ['MigrationTest1', 'Migrationtest2'],
            exportPath: exportPath,
            strict: false
        };

        deleteFolderRecursive(exportPath);

        migration.exportTableDataToFolder(options, function (err, data) {
            expect(err).to.be.null;
            expect(data).not.to.be.null;
            done();
        });
    });


    it('should return expected error upon trying to export without tableList and without exportAllTables', function (done) {
        var TAG = 'should return expected error upon trying to export without tableList and without exportAllTables]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var exportPath = path.resolve(process.cwd(), 'test', 'export');
        var options = {
            exportPath: exportPath
        };

        deleteFolderRecursive(exportPath);

        migration.exportTableDataToFolder(options, function (err, data) {
            expect(err).not.to.be.null;
            expect(err.message).to.equal('Either exportAllTables should be set to true or/and tableList must be a string array of table names, containing at least one table name');
            expect(data).to.be.null;
            done();
        });
    });


    it('should return expected error upon trying to export with invalid exportPath', function (done) {
        var TAG = 'should return expected error upon trying to export with invalid exportPath]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var exportPath = path.resolve(process.cwd(), 'some', 'non-existent', 'path');
        var options = {
            tableList: ['MigrationTest1', 'MigrationTest2'],
            exportPath: exportPath
        };

        migration.exportTableDataToFolder(options, function (err, data) {
            expect(err).not.to.be.null;
            expect(err.message).to.contain('no such file or directory');
            expect(data).to.be.null;
            done();
        });
    });


    it('should export without exportPath', function (done) {
        var TAG = 'should return expected error upon trying to export with invalid exportPath]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var options = {
            tableList: ['MigrationTest1', 'MigrationTest2']
        };

        deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'export'));

        migration.exportTableDataToFolder(options, function (err, data) {
            expect(err).to.be.null;
            expect(data).not.to.be.null;
            done();
        });
    });


    it('should return expected error when exporting with empty tableList', function (done) {
        var TAG = 'should return expected error when exporting with empty tableList]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var options = {
            tableList: []
        };

        deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'export'));

        migration.exportTableDataToFolder(options, function (err, data) {
            expect(err).not.to.be.null;
            expect(err.message).to.contain('tableList must be a string array of table names, containing at least one table name');
            expect(data).to.be.null;
            done();
        });
    });

    it('should export with exportAllTables = true', function (done) {
        var TAG = 'should export with exportAllTables = true]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'export'));

        var options = {
            exportAllTables: true
        };

        migration.exportTableDataToFolder(options, function (err, data) {
            expect(err).to.be.null;
            expect(data).not.to.be.null;
            done();
        });
    });


    it('should export with exportAllTables = true and excludeFrameworkTables = true', function (done) {
        var TAG = 'should export with exportAllTables = true]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'export'));

        var options = {
            exportAllTables: true,
            excludeFrameworkTables: true
        };

        migration.exportTableDataToFolder(options, function (err, data) {
            expect(err).to.be.null;
            expect(data).not.to.be.null;
            done();
        });
    });


    it('should export with exportAllTables = true and excludeFrameworkTables = true and excludeTables list', function (done) {
        var TAG = 'should export with exportAllTables = true]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'export'));

        var options = {
            exportAllTables: true,
            excludeFrameworkTables: true,
            excludeTables: ['baseEntity', 'RefCodeBase', 'Role', 'RoleMapping']
        };

        migration.exportTableDataToFolder(options, function (err, data) {
            expect(err).to.be.null;
            expect(data).not.to.be.null;
            done();
        });
    });


    it('should export with exportAllTables = true and tableList', function (done) {
        var TAG = 'should export with exportAllTables = true]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var options = {
            exportAllTables: true,
            tableList: ['MigrationTest2', 'MigrationTest3', 'MigrationTest3']
        };

        migration.exportTableDataToFolder(options, function (err, data) {
            expect(err).to.be.null;
            expect(data).not.to.be.null;
            done();
        });
    });


    it('should download zip of all table data', function (done) {
        this.timeout(10000);
        var TAG = 'should download zip of all table data]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var getUrl = '/getzip?exportAllTables=true'; // API to export all tables

        api.get(getUrl).end(function (err, response) {
            expect(err).not.to.be.defined; // Expect no error upon calling API
            expect(response).not.to.be.null;
            expect(response).not.to.be.undefined;
            expect(response.statusCode).to.equal(200); // Expect 200 OK response
            expect(response.headers['content-type']).to.equal('application/octet-stream');
            expect(response.headers['content-disposition']).to.contain('attachment; filename=export');
            done();
        });
    });

    it('should download zip of specific tables', function (done) {
        this.timeout(10000);
        var TAG = 'should download zip of all table data]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var getUrl = '/getzip?tableList=MigrationTest1,MigrationTest2'; // API to export specific tables

        api.get(getUrl).end(function (err, response) {
            expect(err).not.to.be.defined; // Expect no error upon calling API
            expect(response).not.to.be.null;
            expect(response).not.to.be.undefined;
            expect(response.statusCode).to.equal(200); // Expect 200 OK response
            expect(response.headers['content-type']).to.equal('application/octet-stream');
            expect(response.headers['content-disposition']).to.contain('attachment; filename=export');
            done();
        });
    });

    it('should return error if no tables are specfied', function (done) {
        this.timeout(10000);
        var TAG = 'should return error if no tables are specfied]';
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var getUrl = '/getzip'; // No tables specified

        api.get(getUrl).end(function (err, response) {
            expect(err).not.to.be.defined; // Expect no error upon calling API
            expect(response).not.to.be.null;
            expect(response).not.to.be.undefined;
            expect(response.statusCode).to.equal(200); // Expect 200 OK response
            expect(response.headers['content-type']).to.contain('application/json');
            expect(response.body.message).to.equal('Either exportAllTables should be set to true or/and tableList must be a string array of table names, containing at least one table name');
            done();
        });
    });


    it('should successfully import an uploaded zip file', function (done) {
        var TAG = 'should successfully import an uploaded zip file]';
        this.timeout(10000);
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'extracts'));
        var postUrl = '/uploadzip';

        api.post(postUrl)
            .field('name', 'My name')
            .field('phone', 'My phone')
            .attach('import', path.resolve(process.cwd(), 'test', 'db1', 'import.zip'))
            .end(function (err, response) {
                expect(err).not.to.be.defined;
                expect(response).not.to.be.null;
                expect(response.statusCode).to.equal(200);
                expect(JSON.parse(response.text).migratedVersions).to.eql(['21.0.0']);
                done();
            });
    });


    it('should return expected error when trying to upload more than one zip file', function (done) {
        var TAG = 'should return expected error when trying to upload more than one zip file]';
        this.timeout(10000);
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'extracts'));
        var postUrl = '/uploadzip';

        api.post(postUrl)
            .attach('import1', path.resolve(process.cwd(), 'test', 'db1', 'import.zip'))
            .attach('import2', path.resolve(process.cwd(), 'test', 'db1', 'import-bad-data.zip'))
            .end(function (err, response) {
                deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'extracts'));
                expect(err).not.to.be.defined;
                expect(response).not.to.be.null;
                expect(response.statusCode).to.equal(422);
                expect(response.text).to.contain('Exactly one zip file needs to be uploaded');
                done();
            });
    });


    it('should return expected error when importing a zip containing bad data', function (done) {
        var TAG = 'should return expected error when importing zip containing bad data]';
        this.timeout(10000);
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'extracts'));
        var postUrl = '/uploadzip';

        api.post(postUrl)
            .attach('import', path.resolve(process.cwd(), 'test', 'db1', 'import-bad-data.zip'))
            .end(function (err, response) {
                // deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'uploads'));
                deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'extracts'));
                expect(err).not.to.be.defined;
                expect(response).not.to.be.null;
                expect(response.statusCode).to.equal(422);
                expect(response.text).to.equal('Model not found for table MigrationTest3. Skipping clearing of this table. Nothing migrated');
                done();
            });
    });


    it('should return expected error when importing a bad zip file', function (done) {
        var TAG = 'should return expected error when importing a bad zip file]';
        this.timeout(100000);
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'extracts'));
        var postUrl = '/uploadzip';

        api.post(postUrl)
            .attach('import', path.resolve(process.cwd(), 'test', 'db1', 'bad.zip'))
            .end(function (err, response) {
                // deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'uploads'));
                deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'extracts'));
                expect(err).not.to.be.defined;
                expect(response).not.to.be.null;
                expect(response.statusCode).to.equal(422);
                expect(response.text).to.contain('Invalid or unsupported zip format.');
                done();
            });
    });


    it('should return expected error when posting without a zip file', function (done) {
        var TAG = 'should return expected error when posting without a zip file]';
        this.timeout(100000);
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'extracts'));
        var postUrl = '/uploadzip';

        api.post(postUrl)
            .field('import', 'import.zip')
            .end(function (err, response) {
            // deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'uploads'));
                deleteFolderRecursive(path.resolve(process.cwd(), 'test', 'extracts'));
                expect(err).not.to.be.defined;
                expect(response).not.to.be.null;
                expect(response.statusCode).to.equal(422);
                expect(response.text).to.contain('Exactly one zip file needs to be uploaded');
                done();
            });
    });


    it('should migrate successfully after adding new data', function (done) {
        var TAG = '[should migrate successfully after adding new data]';
        this.timeout(100000);
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {verbose: true};

        migration.setBasePath(path.resolve(process.cwd(), 'test', 'db'));

        clearMigrationTestTables(function () {
            deleteMigrationLog(function () {
                copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '24.0.0'), path.join(basePath, '24.0.0'));

                migration.migrate(options, function (err, oldDbVersion, data) {
                    expect(oldDbVersion).to.equal('21.0.0');
                    expect(data.migratedVersions).to.eql(['24.0.0']);
                    done();
                });
            });
        });
    });


    it('should migrate successfully after adding new data with additional fields', function (done) {
        var TAG = '[should migrate successfully after adding new data with additional fields]';
        this.timeout(1000000);
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {verbose: true};

        migration.setBasePath(path.resolve(process.cwd(), 'test', 'db'));
        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '25.0.0'), path.join(basePath, '25.0.0'));

        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(oldDbVersion).to.equal('24.0.0');
            expect(data.migratedVersions).to.eql(['25.0.0']);
            done();
        });
    });

    it('The new data should have the default values populated', function (done) {
        var TAG = '[The new data should have the default values populated]';
        this.timeout(1000000);
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));

        var MigrationTest1 = loopback.findModel('MigrationTest1');
        var opts = {ctx: {tenantId: '/default/tenant2'}};
        MigrationTest1.find({}, opts, function (err, data) {
            if (data && data.length) console.log('data.length =', data.length);
            expect(err).not.to.be.defined;
            expect(data).to.be.defined;
            expect(data.length).to.equal(6);
            var passed = true;
            data.forEach(function (d) {
                if (d.field3 !== 'DEFAULT_VALUE') {
                    passed = false;
                    console.log('failing data:', d);
                }
            });
            expect(passed).to.equal(true);
            done();
        });
    });


    it('should return expected error after adding new data with additional fields with wrong types', function (done) {
        var TAG = '[should return expected error after adding new data with additional fields with wrong types]';
        this.timeout(1000000);
        console.log(chalk.yellow('[' + new Date().toISOString() + ']      : ', 'Starting ' + TAG));
        var options = {verbose: true};

        migration.setBasePath(path.resolve(process.cwd(), 'test', 'db'));
        copyRecursiveSync(path.join(process.cwd(), 'test', 'db1', '26.0.0'), path.join(basePath, '26.0.0'));

        migration.migrate(options, function (err, oldDbVersion, data) {
            expect(err).to.be.defined;
            expect(err.message).to.contain('Model MigrationTest4 specified in');
            expect(err.message).to.contain('does not exist');
            expect(oldDbVersion).to.equal('25.0.0');
            expect(data.migratedVersions).to.be.null;
            done();
        });
    });
});
