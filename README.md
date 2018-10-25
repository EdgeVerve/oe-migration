## Need
Applications often need to load seed data into their databases before they can go live. They may also need to load incremental amounts of data from time to time after go-live.
To cater to this need, a dedicated migration module is needed which can perform the most common database operations using supplied data.

## Features
This migration module has the following features:

1. App list module - This would be built as an app-list module which can be added to the application on a need basis.
2. Allow loading of data from JSON files present in project folder to database
3. Allow loading of data over http (zip file upload)
4. Trigger migration via http API
5. Trigger migration via standalone command (node migrate)
6. Allow targeted DDL/DML changes:
    a) Allow writing meta-data to specify add/change/drop column column-name/type
    b) Auto populate default data in existing records for a new column
    c) re-populate changed columns with existing data
7. Allow download of migration logs
8. Option to skip oeCloud Validations
9. Option to clear the data in one or more tables before commencing data loading.
10. Allow versioned data loading.
11. Have an option to download the existing data in the DB (arbitrary list of tables, or all tables) as a zip file
12. Have an option to upload above zip file to the app database after clearing existing data in corresponding tables.