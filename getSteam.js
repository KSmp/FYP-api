// const https = require('https')
// const fs = require('fs');

// const optionsAll = {
//   hostname: 'api.steampowered.com',
//   path: '/ISteamApps/GetAppList/v2/',
//   method: 'GET'
// }

// let optionsGames = {
//   hostname: 'store.steampowered.com',
//   path: '/api/appdetails?appids=',
//   method: 'GET'
// }

// let allApps = null

// https.get(optionsAll, (res) => {
//   let body = "";

//   res.on("data", (chunk) => {
//       body += chunk;
//   });

//   res.on("end", () => {
//       try {
//           let json = JSON.parse(body);
//           allApps = json.applist.apps
//           createJSON()
//       } catch (error) {
//           console.error(error.message);
//       };
//   });

// }).on("error", (error) => {
//   console.error(error.message);
// });

// let rawdata = fs.readFileSync('foo.json');
// allApps = JSON.parse(rawdata);

// createJSON()

// function createJSON() {
//   let toFile = []
//   console.log(allApps.length)
//   allApps.forEach((app, index) => {
//     if(app.name == '' || app.name.includes("Content") || app.name.includes("Download") || app.name.includes("Pt.") || app.name.includes("kink") || app.name.includes("Kink") || app.name.includes("tool") || app.name.includes("server") || app.name.includes("Server") || app.name.includes("Edition") || app.name.includes("Vol") || app.name.includes("Furry") || app.name.includes("Season") || app.name.includes("Horny") || app.name.includes("Girls") || app.name.includes("demo") || app.name.includes("Additional") || app.name.includes("Outfit") || app.name.includes("SEX") || app.name.includes("Maker") || app.name.includes("maker") || app.name.includes("Blowjob") || app.name.includes("Boob") || app.name.includes("Dick") || app.name.includes("Sex") || app.name.includes("18+") || app.name.includes("Editor") || app.name.includes("Skin") || app.name.includes("Movie") || app.name.includes("Film") || app.name.includes("Documentary") || app.name.includes("RPG") || app.name.includes("Costume") || app.name.includes("Edition") || app.name.includes("Free") || app.name.includes("OST") || app.name.includes("Art") || app.name.includes("Wallpapers") || app.name.includes("Soundtrack") || app.name.includes("Demo") || app.name.includes("Pack") || app.name.includes("Part") || app.name.includes("Trial") || app.name.includes("Trailer") || app.name.includes("Guide") || app.name.includes("DLC") || app.name.includes("Playtest") || app.name.includes("VR") || app.name.includes("MP") || app.name.includes("Artbook") || app.name.includes("(R)") || app.name.includes("vol") || app.name.includes("Vol") || app.name.includes("season") || app.name.includes("episode") || app.name.includes("Episode") || app.name.includes("set") || app.name.includes("Set") || app.name.includes("adult") || app.name.includes("Adult") || app.name.includes("remix") || app.name.includes("Remix") || app.name.includes("\\") || app.name.includes("69") || app.name.includes("hentai") || app.name.includes("Hentai") || app.name.includes("remaster") || app.name.includes("Remaster") || app.name.includes("remake") || app.name.includes("Remake") || !onlyLatinCharacters(app.name) || app.name.includes("test") || app.name.includes("Test")) {
//       return
//     } else {
//       toFile.push(app)
//     }
//   });

//   console.log(toFile.length)

//   fs.writeFile('./foo.json', JSON.stringify(toFile), (err) => {
//     if (!err) {
//       console.log('done')
//     }
//   });

//   rawdata = fs.readFileSync('gamesBackup.json');
//   let onlyGames = JSON.parse(rawdata);

//   toFile.forEach((app, index) => {
//     setTimeout(() => {
//       optionsGames.path = '/api/appdetails?appids=' + app.appid

//       https.get(optionsGames, (res) => {
//         let body2 = "";
      
//         res.on("data", (chunk) => {
//             body2 += chunk;
//         });
      
//         res.on("end", () => {
//             try {
//                 if (body2 == null || body2 == undefined) {
//                   throw new Error('null')
//                 }

//                 let json2 = JSON.parse(body2);
//                 if (json2[app.appid].success == true) {
//                   if (json2[app.appid].data.type == "game") {
//                     onlyGames.push(app)
//                     console.log('\x1b[32m%s\x1b[0m', app.appid)
//                   } else {
//                     console.log('\x1b[36m%s\x1b[0m', app.appid)
//                   }
//                 } else {
//                   console.log('\x1b[36m%s\x1b[0m', app.appid)
//                 }
//             } catch (error) {
//                 console.error(error.message);
//                 console.log(app.appid)
//                 console.error(body2);
//                 fs.writeFile('./gamesError.json', JSON.stringify(onlyGames), (err) => {
//                   if (!err) {
//                     console.log(onlyGames)
//                     console.log("On error")
//                   } else {
//                     console.log(err)
//                   }
//                 });
//                 toFile.length = index + 1
//             };

//             if (index % 100 == 0) {
//               fs.writeFile('./gamesBackup.json', JSON.stringify(onlyGames), (err) => {
//                 if (!err) {
//                   console.log("Backup")
//                 } else {
//                   console.log(err)
//                 }
//               });
//             }
  
//             if (index == (toFile.length - 1)) {
//               fs.writeFile('./games.json', JSON.stringify(onlyGames), (err) => {
//                 if (!err) {
//                   console.log("End")
//                 } else {
//                   console.log(err)
//                 }
//               });
//             }
//         });
      
//       }).on("error", (error) => {
//         console.error(error.message);
//       });
//     }, index * 1500)
//   });
// }

// function onlyLatinCharacters(str) {
//   return /^[a-zA-Z\s!@#$%^&*()_+=[\]{}\|;:'",<.>/?`~\d]+$/.test(str);
// }