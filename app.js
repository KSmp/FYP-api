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

const collection = {
  posts: process.env.COLLECTION_POSTS,
  users: process.env.COLLECTION_USERS,
  groups: process.env.COLLECTION_GROUPS,
  comments: process.env.COLLECTION_COMMENTS,
  accounts: process.env.COLLECTION_ACCOUNTS,
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
  db.collection(target).find().project({ _id:0 }).toArray()
    .then(result => { 
      res.send(result);
    })
    .catch(error => catchError(error))
}

function post(req, res, target, page) {
  db.collection(target).countDocuments( { 'title': page.title })
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

function getOne(req, res, target, fields = {}) {
  db.collection(target).findOne( { "name": req.params.name }, { projection: { _id:0, ...fields }})
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

// NEW

function getTarget(parentType) {
  if (parentType == 'p' || parentType == 'f') {
    return collection.users
  } else {
    return collection.groups
  }
}

function createPost(req) {
  return {
    slug: slug(req.body.title), 
    date: date(),
    excerpt: excerpt(req.body.content),
    ...req.body
  }
}

app.get('/user-groups/:name', (req, res) => {
  db.collection(collection.users).findOne({ "name": req.params.name }, { projection: { _id:0, groups:1 } })
    .then(uG => {
      db.collection(collection.groups).find({"name" : {"$in" : uG.groups}}).project({ _id:0, name:1, img:1 }).toArray()
        .then(result => { 
          res.send(result);
        })
        .catch(error => catchError(error))
    })
    .catch(error => catchError(error))
})

app.get('/available-groups/:name', (req, res) => {
  db.collection(collection.users).findOne({ "name": req.params.name }, { projection: { _id:0, groups:1 } })
    .then(uG => {
      db.collection(collection.groups).find({"name" : {"$nin" : uG.groups}}).project({ _id:0, name:1, img:1, background:1 }).toArray()
        .then(result => { 
          res.send(result);
        })
        .catch(error => catchError(error))
    })
    .catch(error => catchError(error))
})

app.get('/group/:name', (req, res) => {
  getOne(req, res, collection.groups, { comments:0 })
})

app.get('/post/:parentType/:parent/:name', (req, res) => {
  getOne(req, res, getTarget(req.params.parentType), { post:1 })
})

app.get('/friends/:name', (req, res) => {
  db.collection(collection.users).findOne({ "name": req.params.name }, { projection: { _id:0, friends:1 } })
    .then(uF => {
      db.collection(collection.users).find({"name" : {"$in" : uF.friends}}).project({ _id:0, name:1, img:1, background:1 }).toArray()
        .then(result => { 
          res.send(result);
        })
        .catch(error => catchError(error))
    })
    .catch(error => catchError(error))
})

app.get('/user/:name', (req, res) => {
  getOne(req, res, collection.users, { coments:0 })
})

app.post('/login', (req, res) => {
  db.collection(collection.accounts).findOne({ "name": req.body.username }, { projection: { _id:0, password:1 } })
    .then(result => {
      if (req.body.password == result.password) {
        res.send({ isLoggedIn: true, name: req.body.username })
      } else {
        res.send({ isLoggedIn: false, name: null })
      }
    })
    .catch(error => catchError(error))
})

app.post('/register', (req, res) => {
  db.collection(collection.accounts).countDocuments({ 'name': req.body.username })
    .then(result => {
      if (parseInt(result) > 0) {
        res.status(409).send({ created: false })
      } else {
        db.collection(collection.accounts).insertOne(req.body, { forceServerObjectId: true })
          .then(result => {
            res.status(201).send({ created: true });
          })
          .catch(error => catchError(error))
      }
    })
    .catch(error => catchError(error))
})

app.post('/create-group', (req, res) => {
  db.collection(collection.groups).countDocuments({ 'name': req.body.groups })
    .then(result => {
      if (parseInt(result) > 0) {
        res.status(409).send({ created: false })
      } else {
        db.collection(collection.groups).insertOne(req.body, { forceServerObjectId: true })
          .then(result => {
            res.status(201).send({ created: true });
          })
          .catch(error => catchError(error))
      }
    })
    .catch(error => catchError(error))
})

app.post('/create-post/:parentType/:parent', (req, res) => {
  let post = createPost(req)
  db.collection(getTarget(req.params.parentType)).countDocuments({ 'title': req.body.title, 'name': req.params.parent })
    .then(result => {
      if(parseInt(result) > 0) {
        post.slug = post.slug + "-" + (parseInt(result) + 1);
      }
      
      db.collection(getTarget(req.params.parentType)).findOneAndUpdate({ slug: req.params.slug}, update)
        .then(result => {
          res.status(200).send();
        })
        .catch(error => catchError(error))

      db.collection(getTarget(req.params.parentType)).insertOne(post, {forceServerObjectId: true})
        .then(result => {
          res.status(201).send({ created: true });
        })
        .catch(error => catchError(error))
    })
    .catch(error => catchError(error))
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
 *  LISTEN
 */
app.listen(process.env.SERVER_PORT, function() {
  console.log('Listening on port ', process.env.SERVER_PORT);
});