# Example Sitemap generator

This is an example of how to generate a custom sitemap that is generated on a periodic schedule and has the files hosted on the Kibo CDN.

After loading all products, it will upload a "sitemap.xml" into your files. You need to set up manually set up the redirect from `/sitemap.xml` to `/cms/files/sitemap.xml`, which you only need to do once.

## Environment
Requires a `.env` file, and a `mozu.config.json` file with your Kibo configuration.

You most likely want to run this application as a lambda function using the serverless http package. You will need to set.
```
CLOUD_ENV=lambda
``` 
in your .env file.

Edit the configuration in serverless.yml according to the schedule you want to generate against.

To run locally,
```
export CLOUD_ENV=localtest
node src/app.js
``` 

## Deploying

To deploy to your own AWS account
```
serverless deploy
``` 
