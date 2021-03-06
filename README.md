## Table of Contents
- [Need](#Need)<BR>
- [Features](#Features)<BR>
- [Implementation](#Implementation)<BR>
- [Setup](#Setup)<BR>
- [Usage](#Usage)<BR>
    - [Migration from Command-Line](#Migration from Command-Line)<BR>
    - [Running Custom JS files](#Running Custom JS files)<BR>
    - [Downloading zip file of DB data](#Downloading zip file of DB data)<BR>
    - [Uploading zip file for migration](#Uploading zip file for migration)<BR>
- [Configuration](#Configuration)
    - [meta.json](#meta.json)
    - [migrate() function](#migrate function)
- [Issues and To-Do](#Issues and To-Do)


<a name="Need"></a>
## Need
Applications often need to load seed data into their databases before they can go live.
This data could be inserts, updates (whole record replacement) or updateAttributes (replacement of one or more field data). Data may also need to be processed and loaded into the DB by application-specific JS files.

They may also need to load incremental amounts of data from time to time after go-live, incorporating any structural changes to the tables.

Sometimes, an app which had undergone several incremental DB updates (both DDL and DML) needs to be freshly deployed
at a new location, with the latest DB state as the first deployment.

To cater to these needs, a dedicated migration module is needed which can perform the most common database operations using supplied data.

<a name="Features"></a>
## Features
This migration module has the following features:

1. App list module - This module is built as an [app-list module](#bookmark0) which can be added to the application on a need basis.

2. Allows loading of data from [JSON files present in a project sub-folder](#bookmark2) or any other folder, to database

3. Allows loading of data from [JSON files present in the project's app-list modules](#bookmark2b), to database

4. Allows [execution of JS files](#Running Custom JS files) for custom processing and migration to database

5. Allows [versioned data migration](#bookmark2), with data-folder name as the DB version. (de-linked from app package version).

6. Re-running of migration script without adding any new data causes no harm

7. Migration can be [triggered via a standalone command](#bookmark1) at the command prompt (node server/migratejs)

8. Allows sequential DDL/DML changes:
    - [Allows writing version-specific meta-data](#bookmark2) (model definitions) to specify structural changes to tables
    - Auto [populate default data](#bookmark2a) in existing records for a new column

9. Has an [option to download the existing data](#bookmark3) in the DB (arbitrary list of tables, or all tables) as a zip file
10. Allows migration of data over http as a [zip file upload](#bookmark4)
11. Allows [download of migration logs](#bookmark5) over http (logs persisted in MigrationLogs table)
12. Has option to [skip oeCloud Validations](#bookmark6) during migration
13. Has option to [use updateAttributes instead of upsert](#bookmark6) during migration
14. Has option to [clear the data in one or more tables](#bookmark6) before commencing data migration.
15. Has option to [rollback](#bookmark6a) to a previous db version
16. Allows [execution of custom JS files](#Running Custom JS files) pre- and/or post- migration.

<a name="bookmark0"></a>
<a name="Implementation"></a>
## Implementation
The **oe-migration** module provides the infrastructure for catering to the above need. It is implemented as an **app-list**
module for **oe-Cloud** based applications.
The module consists of a `lib/migration.js` file which exposes a `migrate()` function, which is the function to be called for performing a migration operation.

A `boot/migration-routes.js` file exposes the following HTTP API endpoints:

- `/getzip` - for downloading existing data in the application database as a zip file, and
- `/uploadzip` - for uploading a zip file with data to the application database

The module also adds a couple of new tables called `MigrationLog` and `SystemConfig` to the application. The former stores logs
of data migration and the latter holds the current DB version.

<a name="Setup"></a>
## Setup
To get the *oe-migration* feature, the following changes need to be done in the *oe-Cloud* based application:

1. This (**oe-migration**) module needs to be added as application  ``package.json`` dependency.
2. This module needs to be added to the `server/app-list.json` file in the app.

The code snippets below show how steps 1 and 2 can be done:

**package.json**  (only part of the file is shown here, with relevant section in **bold**):

<pre>
...
   ...
   "dependencies": {
       ...
       ...
       ...
       <B>"oe-migration": "git+https://github.com/EdgeVerve/oe-migration.git#2.0.0",</B>
       ...
       ...
</pre>

**server/app-list.json**   (Relevant section in **bold**):

<pre>
[
    {
        "path": "oe-cloud",
        "enabled": true
    },
    <b>{
        "path": "oe-migration",
        "enabled": true
    },</b>
	{
        "path": "./",
        "enabled": true
    }
]
</pre>

<a name="Usage"></a>
## Usage
This module can be used for the following purposes:

- Migration of application seed data from Command-Line
- Migration of app-list module's seed data from Command-Line
- Downloading zip file of DB data
- Uploading zip file for migration

<a name="Migration from Command-Line"></a>
### Migration from Command-Line

Once the above changes are done to the application, the migration can be done as follows:

<a name="bookmark2"></a>
 0 . Place your data as **JSON files** and **meta.json** inside a "db" folder in the root of your application, as before (oeCloud version <1.6). The db version folder (e.g., 1.0.0, 1.2.0, etc.,)
 naming should follow [semver convention](https://semver.org/). Basically, it should be in x.y.z format where x,y and z are integers.

   The folder structure inside the "db" folder should be as follows:

```

           PROJECT_ROOT/db-
                          |-1.0.0-
                          |      |
                          |      |-default-
                          |      |        |-Customer.json
                          |      |        |-Account.json
                          |      |        |-custom-script-1.js
                          |      |
                          |      |-tenant1-
                          |      |        |-Customer.json
                          |      |        |-Account.json
                          |      |        |-custom-script-2.js
                          |      |
                          |      |-meta.json
                          |      |
                          |      |-ddl-
                          |           |-customer.json
                          |           |-account.json
                          |
                          |-1.2.0-
                          |      |
                          |      |-default-
                          |      |        |-Customer.json
                          |      |
                          |      |-tenant1-
                          |      |        |-Account.json
                          |      |        |-custom-script-3.js
                          |      |
                          |      |-meta.json
                          |      |
                          |      |-ddl-
                          |           |-customer.json
                          |
                          |-2.0.0-
                                 |
                                 |-default-
                                 |        |-Customer.json
                                 |
                                 |-tenant1-
                                 |        |-Account.json
                                 |        |-custom-script-4.js
                                 |
                                 |-meta.json



```
<a name="bookmark2a"></a>
As seen above, there is a new optional folder called `ddl` under each db version folder. This folder can contain one or more model definition JSON files in the loopback format.
These model definitions, if present, would be used to refresh the corresponding table structures before commencement of migration for that particular version of database.
**This feature allows for arbitrary structural changes in each db version that can be played back in case of new deployments at a later time.**

Note: Using the **ddl** folder feature, if in a particular db version, a new **mandatory field** with a **default** value is added to a table,
then the records that existed in the table prior to the current db version migration would be automatically updated with the default value in the newly added field.


2. Create a new js file, say, *migrate.js* in your `<PROJECT_ROOT>/server/` folder with the following contents:

    ```javascript
    var app = require('oe-cloud');
    app.boot(__dirname, function (err) {
        if (err) { console.log(err); process.exit(1); }

        var m = require('oe-migration');
        m.migrate(function(err, oldDbVersion, migratedVersions) {
            if(err) process.exit(1); else process.exit(0);
        });
    });
    ```
    This file creation is a one-time activity, and the file itself can be part of your application.

    **Note:** This sample file does not pass the `options` parameter to the `migrate()` function. However, it is possible to configure some aspects of migration if you pass the appropriate `options` object. See [**migrate() function**](#migrate function) under the [**Configuration**](#Configuration) section below, for details.
<a name="bookmark1"></a>
3. From a command prompt at the root of your application, run the following:

    ```bash
    $ node server/migrate.js
    ```
    <a name="bookmark5"></a>
    Running the migration script should produce some informative output on the console, an example of which is given below:

```
**************************************************************************************
Data Migration Started: Thu Oct 11 2018 12:59:57 GMT+0530 (India Standard Time)
Migration options : {}
Base Path for data: D:\my-awesome-app\db
Migrated 3 records to table MigrationTest1 for tenant default with 3 succeeding and 0 failing, from D:\my-awesome-app\db\3.3.0\default\migration-test1.json
Migration done. DB updated to 3.3.0
Previous DB Version: 3.2.0
Migrated Versions  : ["3.3.0"]
NOTE: "MigrationLog" table may have useful logs
Data Migration completed in 0.069 sec
Data Migration Ended: Thu Oct 11 2018 12:59:57 GMT+0530 (India Standard Time)

**************************************************************************************

```
More detailed logs can be obtained by looking at the `MigrationLog` table. This is accessible over the standard *loopback* http API `/api/MigrationLogs`.
These can be queried based on its fields `logType`, `model`, `dbVersion`, `tenant`, `filePath`, `migrationDate` and `log`
An example of MigrationLogs is shown below:

```bash
{ "_id" : ObjectId("5bbf21226be2d91d28a37167"), "logType" : "INFO", "model" : "MigrationTest1", "dbVersion" : "3.0.0", "tenant" : "/default", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.0.0\\default\\migration-test1.json", "migrationDate" : ISODate("2018-10-11T10:08:34.134Z"), "log" : { "message" : { "total" : 3, "success" : 3, "failed" : 0 } } }
{ "_id" : ObjectId("5bbf21226be2d91d28a3716b"), "logType" : "INFO", "model" : "MigrationTest2", "dbVersion" : "3.0.0", "tenant" : "/default", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.0.0\\default\\migration-test2.json", "migrationDate" : ISODate("2018-10-11T10:08:34.176Z"), "log" : { "message" : { "total" : 3, "success" : 3, "failed" : 0 } } }
{ "_id" : ObjectId("5bbf21226be2d91d28a3716f"), "logType" : "INFO", "model" : "MigrationTest1", "dbVersion" : "3.0.0", "tenant" : "/default/tenant1", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.0.0\\tenant1\\migration-test1.json", "migrationDate" : ISODate("2018-10-11T10:08:34.218Z"), "log" : { "message" : { "total" : 3, "success" : 3, "failed" : 0 } } }
{ "_id" : ObjectId("5bbf21226be2d91d28a37173"), "logType" : "INFO", "model" : "MigrationTest2", "dbVersion" : "3.0.0", "tenant" : "/default/tenant1", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.0.0\\tenant1\\migration-test2.json", "migrationDate" : ISODate("2018-10-11T10:08:34.250Z"), "log" : { "message" : { "total" : 3, "success" : 3, "failed" : 0 } } }
{ "_id" : ObjectId("5bbf21226be2d91d28a37177"), "logType" : "INFO", "model" : "MigrationTest1", "dbVersion" : "3.0.0", "tenant" : "/default/tenant2", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.0.0\\tenant2\\migration-test1.json", "migrationDate" : ISODate("2018-10-11T10:08:34.288Z"), "log" : { "message" : { "total" : 3, "success" : 3, "failed" : 0 } } }
{ "_id" : ObjectId("5bbf21226be2d91d28a3717b"), "logType" : "INFO", "model" : "MigrationTest2", "dbVersion" : "3.0.0", "tenant" : "/default/tenant2", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.0.0\\tenant2\\migration-test2.json", "migrationDate" : ISODate("2018-10-11T10:08:34.339Z"), "log" : { "message" : { "total" : 3, "success" : 3, "failed" : 0 } } }
{ "_id" : ObjectId("5bbf22406be2d91d28a3717c"), "logType" : "INFO", "model" : "MigrationTest1", "dbVersion" : "3.2.0", "tenant" : "/default", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.2.0\\default\\migration-test1.json", "migrationDate" : ISODate("2018-10-11T10:13:20.452Z"), "log" : { "message" : { "total" : 3, "success" : 3, "failed" : 0 } } }
{ "_id" : ObjectId("5bbf22406be2d91d28a37180"), "logType" : "INFO", "model" : "MigrationTest2", "dbVersion" : "3.2.0", "tenant" : "/default", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.2.0\\default\\migration-test2.json", "migrationDate" : ISODate("2018-10-11T10:13:20.488Z"), "log" : { "message" : { "total" : 3, "success" : 3, "failed" : 0 } } }
{ "_id" : ObjectId("5bbf22406be2d91d28a37183"), "logType" : "WARN", "model" : "MigrationTest1", "dbVersion" : "3.2.0", "tenant" : "/default/tenant1", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.2.0\\tenant1\\migration-test1.json", "migrationDate" : ISODate("2018-10-11T10:13:20.521Z"), "log" : { "message" : "The `MigrationTest1` instance is not valid. Details: `field2` can't be blank (value: undefined).", "data" : { "field1" : "tenant1-Rama2" } } }
{ "_id" : ObjectId("5bbf22406be2d91d28a37185"), "logType" : "INFO", "model" : "MigrationTest1", "dbVersion" : "3.2.0", "tenant" : "/default/tenant1", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.2.0\\tenant1\\migration-test1.json", "migrationDate" : ISODate("2018-10-11T10:13:20.537Z"), "log" : { "message" : { "total" : 4, "success" : 3, "failed" : 1 } } }
{ "_id" : ObjectId("5bbf22406be2d91d28a37189"), "logType" : "INFO", "model" : "MigrationTest2", "dbVersion" : "3.2.0", "tenant" : "/default/tenant1", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.2.0\\tenant1\\migration-test2.json", "migrationDate" : ISODate("2018-10-11T10:13:20.572Z"), "log" : { "message" : { "total" : 3, "success" : 3, "failed" : 0 } } }
{ "_id" : ObjectId("5bbf22406be2d91d28a3718d"), "logType" : "INFO", "model" : "MigrationTest1", "dbVersion" : "3.2.0", "tenant" : "/default/tenant2", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.2.0\\tenant2\\migration-test1.json", "migrationDate" : ISODate("2018-10-11T10:13:20.610Z"), "log" : { "message" : { "total" : 3, "success" : 3, "failed" : 0 } } }
{ "_id" : ObjectId("5bbf22406be2d91d28a37191"), "logType" : "INFO", "model" : "MigrationTest2", "dbVersion" : "3.2.0", "tenant" : "/default/tenant2", "filePath" : "D:\\oecloud.io\\oe-migration\\test\\db\\3.2.0\\tenant2\\migration-test2.json", "migrationDate" : ISODate("2018-10-11T10:13:20.661Z"), "log" : { "message" : { "total" : 3, "success" : 3, "failed" : 0 } } }
{ "_id" : ObjectId("5bbf22406be2d91d28a37192"), "logType" : "INFO", "model" : null, "dbVersion" : "3.2.0", "tenant" : null, "filePath" : null, "migrationDate" : ISODate("2018-10-11T10:13:20.695Z"), "log" : { "message" : "Migration done. DB updated to 3.2.0" } }

```

The `server/migrate.js` can be executed repeatedly with/without additional data in the `<server>/db` folder.



<a name="bookmark2b"></a>
### Migration of app-list module seed data

*oe-migration* supports the migration of seed-data from *app-list* modules by leveraging the `options.basePath` parameter of the `migrate()` function.

For this to work, 

1. Each *app-list* module should have its own seed-data in a folder named `db` at the module's root.
2. Create and run a new js file, say, *migrate-all.js* in your `<PROJECT_ROOT>/server/` folder with the following contents:

    ```javascript

    var app = require('oe-cloud');
    var async = require('async');
    var m = require('oe-migration');
    var path = require('path');
    var fs = require('fs');
    
    app.boot(__dirname, function (err) {
      if (err) { console.log(err); process.exit(1); }
    
      var appList = getAppList();
    
      async.eachOfSeries(appList, function (mdl, key, cb) {
        m.migrate({ moduleName: mdl.moduleName, basePath: mdl.basePath }, function (err, oldDbVersion, migratedVersions) {
          cb(err);
        });
      }, function (err) {
        if (err) {
          console.log(err);
          process.exit(1);
        } else {
          console.log('migration done');
          process.exit(0);
        }
      });
    });
    
    
    function getAppList() {
      var appList = [];
      var mdls = require('../server/app-list.json');
      mdls.forEach(function (o) {
        var bPath;
        if (o.path === './')  {
          bPath = path.resolve(process.cwd(), 'db');
        } else {
          bPath = path.resolve(process.cwd(), 'node_modules', o.path, 'db');
        }
        var isDir = false;
        try {
          isDir = fs.statSync(bPath).isDirectory();
          if (isDir === true) appList.push({ moduleName: o.path, basePath: bPath});
        } catch (e) {
          if (e) console.log('Ignoring module', o.path, ' : No db folder');
        }
      });
      return appList;
    }
    ```
    This file creation is a one-time activity, and the file itself can be part of your application.

**Notes:**

1. The above script, when run, does the migration of data in the `db` folders from each *app-list* module, in the order in which the module is specified in the application's `app-list.json` file.
2. The above script also migrates the main application's `db` folder, again, as per the order of the `./` module specified in `app-list.json`
3. The application developer is free to modify the sample migrate-all.js file to meet the application's needs. For example, the developer could choose not to migrate data from one or more app-list modules, change the location from where data is migrated, etc.,
4. While modifying the *migrate-all.js* script, keep in mind the `moduleName` option of `migrate()` function. This is used by *oe-migration* as a key to maintain the latest DB migration version in the *SystemConfig* table. This should be set as the name of the module whose data is being migrated. If the module is the main application itself, `moduleName` can be omitted or set to the default value, `./`

<a name="Running Custom JS files"></a>
### Running Custom JS files

*oe-migration* supports running arbitrary JS files in addition to loading data from json files. These files are to be placed and configured similar to how this is done for json files, in `meta.json`. See [Configuration](#Configuration) for details. 
JS files are run by *oe-migration* in the order it appears in `meta.json`.

The JS files that should be run as part of migration need to use the following standard:

1. The JS file/script needs to export a single function
2. The exported function needs to have the following 2 arguments -

    a) opts - This Object would contain the context as defined in `meta.json`  
    b) cb   - This is a callback function that needs to be called from within the script to signal the end of processing in the script. 
3. The callback function may be called with an error object. This will halt the migration.
4. Failure to call `cb()` would cause the migration process to wait indefinitely.

An example JS file is shown below:

```javascript

module.exports = function(opts, cb) {
	console.log(opts);  // contains the ctx as specified in meta.json
	// do processing
	// more processing
	
	cb(err);    // err should be undefined or null if all is well.
	            // Otherwise migration is halted.
	
}

```



<a name="bookmark3"></a>
<a name="Downloading zip file of DB data"></a>
### Downloading zip file of DB data

The **oe-migration** module exposes a http GET API, `/getzip`, for downloading data from all or a subset of tables in the application.

The downloaded data is in the form of a zip file which contains *JSON data* files and a `meta.json` file.

The file and data structure is compatible with the file and data structure required by the `migrate()` function.

The `/getzip` API can take the following optional query parameters:

- `tableList` - Optional if *exportAllTables* is *true*. Value is a comma-separated list of table (model) names whose data needs to be exported as a zip file
- `exportAllTables` - Optional if at least one table is specified in *tableList*. Value, if *true*, exports data from all tables, including framework model data
- `excludeFrameworkTables` - Optional. To be used if *exportAllTables* is set to *true*. Value, if *true*, excludes data of framework models from the exported zip file

Some example usages of this API is as follows:

```
http://<app_host>:<app_port>/getzip?tableList=Currency,Account                                   // Exports data of Currency and Account only

http://<app_host>:<app_port>/getzip?exportAllTables=true                                         // Exports data of all tables

http://<app_host>:<app_port>/getzip?exportAllTables=true&excludeFrameworkTables=true             // Exports data of all tables except framework tables like Role, etc.,

http://<app_host>:<app_port>/getzip?exportAllTables=true&excludeFrameworkTables&tableList=Role   // Exports data of all tables except framework tables, additionally
                                                                                                 // include the framework table 'Role'
```

<a name="bookmark4"></a>
<a name="Uploading zip file for migration"></a>
### Uploading zip file for migration
The **oe-migration** module exposes a http POST API, `/uploadzip`, for uploading data in the form of a zip file to tables in the application.

The zip file content should be the same structure and format as the `<db_version>` folder. So, the folder structure inside the zip
file should be as follows:

<pre>
1.0.0-
     |
     |-default-
     |        |-Customer.json
     |        |-Account.json
     |
     |-tenant1-
     |        |-Customer.json
     |        |-Account.json
     |
     |-meta.json
</pre>

The file upload API accepts a `multipart/form-data` type request with the zip file as an input type=file attachment.

An example upload form is provided in this module at the `GET /uploadzip` endpoint.

The response of a sucessful zip-file upload is a 200 OK JSON response with a `migratedVersions` property giving the array of migrated versions.
Any error will result in a non-200 OK response with appropriate error message in the body of the response.

Only one zip file is allowed at a time, to be uploaded.

<a name="Configuration"></a>
## Configuration
The migration configuration is done through -

1. the `<PROJECT_ROOT>/db/<version>/meta.json` and
2. the `options` argument of the module's `migrate()` function

<a name="meta.json"></a>
### meta.json

This file needs to be present for each version of DB migration
For e.g., one project could have the following files for each of the db versions 1.0.0, 1.2.0 and 2.0.0:

```
<PROJECT_DIR>/db/1.0.0/meta.json
<PROJECT_DIR>/db/1.2.0/meta.json
<PROJECT_DIR>/db/2.0.0/meta.json
```
<a name="bookmark6"></a>
Each of these `meta.json` files define the contexts and data file/JS script details for its corresponding DB version migration. In addition, the `meta.json` can also optionally configure -
- whether all tables or specified tables are cleared or not before migration
- whether oeCloud validations are skipped for migration or not
- whether the json data is to be used to do an updateAttributes instead of an upsert or not
- whether an alternate field is to be used instead of the id field as PK for upsert/updateAttributes


The structure of the `meta.json` file along with these configuration parameters, is explained with the example below:

```js
{
    "clearTables": true,    // Optional property, value can be boolean or string array of table names. Default: false
                            // 'true' - clears all tables in the 'files' section of this file before starting to migrate
                            // [array of table names] - clears specified tables before starting to migrate

    "contexts": {           // Contexts to use for migration

        "/default": {                     // context-key is a slash-separated string starting with '/default'
            "id": 0,                      // 'id' value is a running serial number
            "tenantId": "/default",       // 'tenantId' value is the same as the context-key
            "remoteUser": "defaultuser"   // 'remoteUser' user as whom the migration is done
        },

        "/default/tenant1": {
            "id": 1,
            "tenantId": "/default/tenant1",
            "remoteUser": "tenant1user"
        }

    },

    "files": [
        {
            "skipValidation": true,           // Optional property, value is boolean. Default: false. Ignored if file is JS script
                                              // If true, skips oeCloud validation during migration of this file

            "updateAttributes": true,         // Optional property, value is boolean. Default: false. Ignored if file is JS script
                                              // If true, does an updateAttributes instead of an upsert for this file.
                                              // If this is set to true, the json data needs to have an 'id' field for each
                                              // record. Alternatively, the 'key' property (see below) needs to be specified.

            "key": "field2",                  // Optional property. Ignored if file is JS script. Value is a string fieldname. Used in conjunction with
                                              // "updateAttributes" (see above) Specifies a unique field other than 'id' to be
                                              // used as PK for performing updateAttributes using data in this file.

            "model": "Customer",              // Mandatory property if file is json. The model name to use for this json file's migration. Ignored if file is JS script

            "enabled": true,                  // Optional property. If false, skips migration from this file. Default: true

            "file": "default/customer.js(on)",  // Mandatory property. Relative path under "db" folder to the json/JS file's location

            "ctxId": "/default"               // Mandatory property. Should match one of the keys under "contexts"
        },

        {
            "model": "Account",
            "enabled": true,
            "file": "tenant1/Account.json",
            "ctxId": "/default/tenant1"
        }
    ]
}

```
<a name="bookmark6a"></a>
<a name="migrate function"></a>
### migrate() function

The **oe-migration** module exposes the `migrate(options, cb)` function, which takes the following 2 arguments -

- an `options` object and
- a callback function, `cb`,

both of which are optional.

The `options` object can have the following properties, illustrated with an example:

```js
{
    basePath: '/data/db',    // Optional String. Specifies the absolute path to a folder to be used as the "db" folder.
                             // Default value is the "db" folder at the root of the oeCloud application.

    moduleName: 'my-app',    // Optional String. Specifies the name of the module/app for which this migration is done.
                             // Default value is "./", the same string that is specified for "current application" in app-list.json.
                             // This is used by oe-migration as a key to maintain the latest DB migration version in the SystemConfig table. 

    force: true,             // Optional. If true, repeats migration from all db versions present in "db" folder,
                             // ignoring the last version that was migrated (last version being in SystemConfig table)

    fromVersion: '2.0.0',    // Optional. When used with force: true, sets the starting db version for
                             // forced migration. Default: '0.0.0'

    toVersion: '4.0.0',      // Optional. When used with force: true, sets the ending db version for
                             // forced migration. Default: last available version in "db" folder

    verbose: true            // Optional. Prints additional info to the console during migration, for
                             // e.g., record level errors (which are captured in MigrationLogs table irrespective of this option)

}

```

**Note:** A **rollback operation** can be implemented by using the `clearTables` option in `meta.json` and using the `force` option, along with the `toVersion` option.


The callback function has the following arguments:

```
function cb(err, oldDbVersion, data) {

}
```

- `err` - An error object. If not null, it contains `err.message` which describes the error.
- `oldDbVersion` - A string. If not null, it has the value of the DB version before commencement of migration. If null, this means there was no migration done before.
- `data` - An object. If not null, it has the following fields:
    - `migratedVersions` - A string array. If not null, it contains the db versions that have been migrated in this run of migration. If null, it indicates that no migration happened.
    - `warnings` - A string array. If defined, it contains any warning messages that were output during the current migration




## Issues and To-Do<a name="Issues and To-Do"></a>

For issues with this module, please contact Ajith Vasudevan (Email: ajith_v@edgeverve.com)

### To-Do<a name="To-Do"></a>
1. Simplify rollback


