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
      if (!result) {
        res.send(null)
        return
      }
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
      if (!uG) {
        res.send(null)
        return
      }
      db.collection(collection.groups).find({"name" : {"$in" : uG.groups}}).project({ _id:0, name:1, img:1, slug:1 }).toArray()
        .then(result => {
          if (!result) {
            res.send(null)
            return
          }
          res.send(result);
        })
        .catch(error => catchError(error))
    })
    .catch(error => catchError(error))
})

app.get('/available-groups/:name', (req, res) => {
  db.collection(collection.users).findOne({ "name": req.params.name }, { projection: { _id:0, groups:1 } })
    .then(uG => {
      if (!uG) {
        res.send(null)
        return
      }
      db.collection(collection.groups).find({"name" : {"$nin" : uG.groups}}).project({ _id:0, name:1, img:1, background:1 }).toArray()
        .then(result => {
          if (!result) {
            res.send(null)
            return
          }
          res.send(result);
        })
        .catch(error => catchError(error))
    })
    .catch(error => catchError(error))
})

app.get('/groups/:name', (req, res) => {
  getOne(req, res, collection.groups, { comments:0 })
})

app.get('/post/:parentType/:parent/:title', (req, res) => {
  db.collection(getTarget(req.params.parentType)).findOne( { "name": req.params.parent }, { projection: { _id:0, posts:1 }})
    .then(result => {
      if (!result) {
        res.send(null)
        return
      }
      result.posts.forEach(post => {
        if (post.slug == req.params.title)  {
          res.send(post)
          return
        }
      })
    })
    .catch(error => catchError(error))
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
  db.collection(collection.accounts).findOne({ 'name': req.body.name }, { projection: { _id:0, password:1 } })
    .then(result => {
      if (result) {
        if (req.body.password == result.password) {
          res.send({ isLoggedIn: true, name: req.body.name })
          return
        } 
      }

      res.send({ isLoggedIn: false, name: null })
    })
    .catch(error => catchError(error))
})

app.post('/register', (req, res) => {
  db.collection(collection.accounts).countDocuments({ 'name': req.body.name })
    .then(result => {
      if (parseInt(result) > 0) {
        res.status(409).send({ created: false })
      } else {
        db.collection(collection.accounts).insertOne(req.body, { forceServerObjectId: true })
          .then(result => {
            const user = {
              name: req.body.name,
              groups: [],
              posts: [],
              friends: [],
              games: [],
              description: "I'm new!",
            }
            db.collection(collection.users).insertOne(user, { forceServerObjectId: true })
              .then(result => {
                res.status(201).send({ created: true });
              })
              .catch(error => catchError(error))
          })
          .catch(error => catchError(error))
      }
    })
    .catch(error => catchError(error))
})

app.post('/create-group', (req, res) => {
  db.collection(collection.groups).countDocuments({ 'name': req.body.name })
    .then(result => {
      if (parseInt(result) > 0) {
        res.status(409).send({ created: false })
      } else {
        const group = {
          slug: slugify(req.body.name),
          name: req.body.name,
          img: req.body.img,
          usersCount: 1,
          access: 1,
          games: [],
          description: req.body.description,
          background: req.body.background,
          posts: [],
          owner: req.body.owner,
          users: [req.body.owner]
        }
        db.collection(collection.groups).insertOne(group, { forceServerObjectId: true })
          .then(result => {
            db.collection(collection.users).findOneAndUpdate({ 'name': group.owner }, { $push: { 'groups': group.slug }})
              .then(result => {
                res.status(201).send({ created: true });
              })
              .catch(error => catchError(error))
          })
          .catch(error => catchError(error))
      }
    })
    .catch(error => catchError(error))
})

app.post('/create-post/:parentType/:parent', (req, res) => {
  let post = createPost(req)
  db.collection(collection.users).findOne({ "name": req.body.author.name }, { projection: { _id:0, img:1 }})
    .then(avatar => {
      if (avatar?.img) {
        post.author.img = avatar.img
      }
      db.collection(getTarget(req.params.parentType)).countDocuments({ 'title': req.body.title, 'name': req.params.parent })
        .then(result => {
          if (parseInt(result) > 0) {
            post.slug = post.slug + "-" + (parseInt(result) + 1);
          }

          db.collection(getTarget(req.params.parentType)).findOneAndUpdate({ 'name': req.params.parent }, { $push: { 'posts': post }})
            .then(result => {
              res.status(201).send({ created: true });
            })
            .catch(error => catchError(error))
        })
        .catch(error => catchError(error))
    })
    .catch(error => catchError(error))
})

app.post('/edit-group/:group', (req, res) => {
  console.log(req.body)
  let updatedGroup = {
    description: req.body.description,
    img: req.body.img,
    background: req.body.background,
    games: req.body.games.split(',')
  }
  db.collection(collection.groups).findOneAndUpdate({ 'slug': req.params.group } , { "$set": updatedGroup })
    .then(result => {
      res.status(200).send()
    })
    .catch(error => catchError(error))
})

app.post('/edit-user/:user', (req, res) => {
  console.log(req.body)
  let updatedUser = {
    description: req.body.description,
    img: req.body.img,
    background: req.body.background,
    games: req.body.games.split(',')
  }
  db.collection(collection.users).findOneAndUpdate({ 'name': req.params.user } , { "$set": updatedUser })
    .then(result => {
      res.status(200).send()
    })
    .catch(error => catchError(error))
})

app.post('/join-group', (req, res) => {
  console.log(req.body)
  if (req.body.add) {
    db.collection(collection.groups).findOneAndUpdate({ 'slug': req.body.group } , { $push: { 'users': req.body.user }, $inc: { 'usersCount': 1 } })
      .then(result => {
        db.collection(collection.users).findOneAndUpdate({ 'name': req.body.user } , { $push: { 'groups': req.body.group }})
          .then(result => {
            res.send({ changed: true })
          })
          .catch(error => catchError(error))
      })
      .catch(error => catchError(error))
  } else {
    db.collection(collection.groups).findOneAndUpdate({ 'slug': req.body.group } , { $pull: { 'users': req.body.user }, $inc: { 'usersCount': -1 } })
      .then(result => {
        db.collection(collection.users).findOneAndUpdate({ 'name': req.body.user } , { $pull: { 'groups': req.body.group }})
          .then(result => {
            res.send({ changed: false })
          })
          .catch(error => catchError(error))
      })
      .catch(error => catchError(error))
  }
})

app.post('/add-friend', (req, res) => {
  console.log(req.body)
  if (req.body.add) {
    db.collection(collection.users).findOneAndUpdate({ 'name': req.body.username1 } , { $push: { 'friends': req.body.username2 }})
      .then(result => {
        db.collection(collection.users).findOneAndUpdate({ 'name': req.body.username2 } , { $push: { 'friends': req.body.username1 }})
          .then(result => {
            res.send({ changed: true })
          })
          .catch(error => catchError(error))
      })
      .catch(error => catchError(error))
  } else {
    db.collection(collection.users).findOneAndUpdate({ 'name': req.body.username1 } , { $pull: { 'friends': req.body.username2 }})
      .then(result => {
        db.collection(collection.users).findOneAndUpdate({ 'name': req.body.username2 } , { $pull: { 'friends': req.body.username1 }})
          .then(result => {
            res.send({ changed: false })
          })
          .catch(error => catchError(error))
      })
      .catch(error => catchError(error))
  }
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