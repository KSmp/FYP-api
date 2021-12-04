require('dotenv').config({ path: '.env'})
const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const slugify = require('slugify');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const fs = require('fs');

let db;
let app = express();

const server = `${process.env.SERVER_PROTOCOL}://${process.env.SERVER_ADDRESS}:${process.env.SERVER_PORT}/`;
let db_uri = `mongodb://${process.env.DB_ADDRESS}/`;
if (process.env.AUTH === 'true') {
  const username = encodeURIComponent(process.env.USERNAME);
  const password = encodeURIComponent(process.env.PASSWORD);
  db_uri = `mongodb://${username}:${password}@${process.env.DB_ADDRESS}/`;
}


app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CLIENT);
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  next();
});

fs.mkdirSync(process.env.IMAGES_DIR, { recursive: true });
app.use(express.json());
app.use(cors());
app.use(fileUpload());
app.use(express.static(process.env.IMAGES_DIR));

MongoClient.connect(db_uri, { useUnifiedTopology: true })
  .then(client => {
    db = client.db(process.env.DB_NAME)
  })
  .catch(error => catchError(error))

function catchError(error) {
  console.error(error);
}

function date() {
  const today = new Date();
  return today.getTime();
}

function slug(title) {
  return slugify(title, { replacement: '-', lower: true })
}

function excerpt(content) {
  return content
    .replace(/(<([^>]+)>)/gi, "")
    .substring(0,200)
}

function createPayload(req) {
  return {
    slug: slug(req.body.title), 
    title: req.body.title,
    content: req.body.content,
  }
}

function setPayload(req) {
  return {
    slug: slug(req.body.title),
    title: req.body.title,
    content: req.body.content,
  }
}

function createPage(req) {
  return createPayload(req)
}

function createPost(req) {
  return {
    ...createPayload(req),
    date: date(),
    excerpt: excerpt(req.body.content),
  }
}

function setPage(req) {
  return {
    "$set": {
    ...setPayload(req)
    }
  }
}

function setPost(req) {
  return { 
      "$set": {
      ...setPayload(req),
      excerpt: req.body.excerpt,
    }
  }
}

function getAll(req, res, target) {
  db.collection(target).find().project({ _id:0, content:0}).toArray()
    .then(result => { 
      res.send(result);
    })
    .catch(error => catchError(error))
}

function post(req, res, target, page) {
  db.collection(target).count( { 'title': page.title })
    .then(result => {
      if(parseInt(result) > 0) {
        page.slug = page.slug + "-" + (parseInt(result) + 1);
      }

      db.collection(target).insertOne(page, {forceServerObjectId: true})
          .then(result => {
            res.status(201).send();
          })
          .catch(error => catchError(error))
    })
    .catch(error => catchError(error))
}

function getOne(req, res, target) {
  db.collection(target).findOne( { "slug": req.params.slug }, { projection: { _id:0 }})
    .then(result => {
      res.send(result);
    })
    .catch(error => catchError(error))
}

function update (req, res, target, update) {
  db.collection(target).findOneAndUpdate( 
    { slug: req.params.slug},
    update
  )
    .then(result => {
      res.status(200).send();
    })
    .catch(error => catchError(error))
}

function remove (req, res, target) {
  db.collection(target).deleteOne(
    { "slug": req.params.slug }
  )
    .then(result=> {
      res.status(200).send();
    })
    .catch(error => catchError(error))
}

/**
 *  GET List
 */
app.get('/page', (req, res) => {
  getAll(req, res, process.env.COLLECTION_PAGE);
})

/**
 *  GET Page
 */
app.get('/page/:slug', (req, res) => {
  getOne(req, res, process.env.COLLECTION_PAGE);
}) 

/**
 *  POST Page
 */
app.post('/page', (req, res) => {
  const page = createPage(req);
  post(req, res, process.env.COLLECTION_PAGE, page);
})

/**
 *  UPDATE Page
 */
app.put('/page/:slug', (req, res) => {
  const set = setPage(req);
  update(req, res, process.env.COLLECTION_PAGE, set);
})

/**
 *  DELETE Page
 */
app.delete('/page/:slug', (req, res) => {
  remove(req, res, process.env.COLLECTION_PAGE);
})



/**
 *  GET Posts
 */
app.get('/posts', (req, res) => {
  getAll(req, res, process.env.COLLECTION_POSTS);
})

/**
 *  GET Post (one)
 */
app.get('/posts/:slug', (req, res) => {
  getOne(req, res, process.env.COLLECTION_POSTS);
})

/**
 *  POST Post
 */
app.post('/posts', (req, res) => {
  const page = createPost(req);
  post(req, res, process.env.COLLECTION_POSTS, page);
})

/**
 *  UPDATE Post
 */
app.put('/posts/:slug', (req, res) => {
  const set = setPost(req);
  update(req, res, process.env.COLLECTION_POSTS, set);
})

/**
 *  DELETE Posts
 */
app.delete('/posts/:slug', (req, res) => {
  remove(req, res, process.env.COLLECTION_POSTS);
})

/**
 *  POST Image
 */
app.post('/images', (req, res) => {
  let upload = req.files.upload
  upload.mv('./images/' + upload.name);
  const url = server + upload.name;
  res.send({
    url
  })
})

/**
 *  ADMIN LOGIN
 */
app.post('/admin', (req,res) => {
  if (req.body.login == process.env.ADMIN && req.body.password == process.env.ADMIN_PASSWD)
    res.send(true);
  else
    res.send(false);
})

/**
 *  LISTEN
 */
app.listen(process.env.SERVER_PORT, function() {
  console.log('Listening on port ', process.env.SERVER_PORT);
});