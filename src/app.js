require("dotenv").config()
const Bottleneck = require("bottleneck")
const express = require('express')

// register the app
const app = express()

const port = process.env.PORT || 3000

// json is required by the platform
app.use(express.json())

// registering routes for express

let uploadFileWithContent = async (documentsResource, filename, fileContent) => {
  console.log("Upload of", filename, "started.")
  const filesDocumentList = "files@mozu";
  let documents = await documentsResource.getDocuments({ documentListName: filesDocumentList, filter: `name eq "${filename}"` });

  // Create the file if it doesn't exist
  let doc_id = null
  if (documents.items.length == 0) {
    let newDoc = await documentsResource.createDocument({ documentListName: filesDocumentList }, {
      body: {
        "listFQN": filesDocumentList,
        "documentTypeFQN": "document@mozu",
        "extension": "xml",
        "name": filename,
      }
    });
    doc_id = newDoc.id
  } else {
    doc_id = documents.items[0].id
  }

  // Update the document with the content
  let newDocContent = await documentsResource.updateDocumentContent({
    documentListName: filesDocumentList, documentId: doc_id
  }, {
    body: fileContent,
    headers: { 'Content-Type': "application/xml" }
  });
  console.log("Upload of", filename, "complete.")
  return newDocContent.id
}


let generateSiteMap = async (req, res) => {
  let productSearchResultResource = require('mozu-node-sdk/clients/commerce/catalog/storefront/productSearchResult')()
  let documentsResource = require('mozu-node-sdk/clients/content/documentlists/document')();
  let randomAccessCursors = await productSearchResultResource.getRandomAccessCursor({ query: "*:*", pageSize: 2000 })
  const limiter = new Bottleneck({ maxConcurrent: 2 });

  // First generate the main "sitemap.xml". This one needs a redirect. Everything else does not.
  await uploadFileWithContent(documentsResource, "sitemap.xml", `<sitemapindex>
    <sitemap>
    <loc>https://www.example.com/sitemap.xml/categories</loc>
    </sitemap>`+ Object.keys([...new Array(randomAccessCursors.cursorMarks.length)]).map(page =>
    `<sitemap>
    <loc> https://www.example.com/cms/files/sitemapPage-${page}.xml </loc>
    </sitemap>`).join("\n") + `</sitemapindex>`)

  // Now upload the sub-sitemaps. We don't just upload one huge site map since the sitemap spec says they have to 
  // be under 50k entries each.
  for (let cursorMarkEntries of Object.entries(randomAccessCursors.cursorMarks)) {
    limiter.schedule(async (cursorMarkEntries) => {
      let index = cursorMarkEntries[0]
      let cursor = cursorMarkEntries[1]
      console.log("Reading cursor ", cursor)
      let xmlChunks = []
      xmlChunks.push(`<urlset>`)
      let results = await productSearchResultResource.search({ cursorMark: cursor, query: "*:*", responseFields: "items(content(seoFriendlyUrl), productCode)"}, { timeout: 60000 })
      for (let product of results.items) {
        xmlChunks.push(`<url>
<loc>https://example.com/shop/${product.content.seoFriendlyUrl}/${product.productCode}</loc>
<changefreq>daily</changefreq>
<priority>.7</priority>
</url>`)
      }
      xmlChunks.push(`</urlset>`)
      await uploadFileWithContent(documentsResource, `sitemapPage-${index}.xml`, xmlChunks.join("\n"))
    }, cursorMarkEntries);
  }
  await limiter.stop({
    dropWaitingJobs: false,
  });
  console.log("All complete.")
}

app.use('/', generateSiteMap)

// run the application
if (process.env.CLOUD_ENV === 'lambda') {
  const serverless = require('serverless-http')
  module.exports.handler = serverless(app)
} else if (process.env.CLOUD_ENV === 'localtest') {
  generateSiteMap()
} else {
  app.listen(port, () => console.log(`Example cloud app listening on port ${port}!`));
}

