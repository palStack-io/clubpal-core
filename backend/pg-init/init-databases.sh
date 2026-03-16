#!/bin/bash
# Create separate databases for each ClubPal microservice

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE clubpal_gateway;
    CREATE DATABASE clubpal_groups;
    CREATE DATABASE clubpal_events;
    CREATE DATABASE clubpal_ratings;
    CREATE DATABASE clubpal_activities;
    CREATE DATABASE clubpal_enrichment;
    CREATE DATABASE clubpal_billsplit;

    GRANT ALL PRIVILEGES ON DATABASE clubpal_gateway TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE clubpal_groups TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE clubpal_events TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE clubpal_ratings TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE clubpal_activities TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE clubpal_enrichment TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE clubpal_billsplit TO $POSTGRES_USER;
EOSQL

echo "ClubPal databases created successfully."
