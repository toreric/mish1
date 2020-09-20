// app/routes.js
module.exports = function (app) {
  var path = require ('path')
  var Promise = require ('bluebird')
  var fs = Promise.promisifyAll (require ('fs'))
  var execP = Promise.promisify (require ('child_process').exec)
  var multer = require ('multer')
  var upload = multer ( {dest: '/tmp'}) // tmp upload
  var exec = require ('child_process').exec
  var execSync = require ('child_process').execSync
  //var bodyParser = require ('body-parser')
  //app.use (bodyParser.urlencoded ( {extended: false}))
  //app.use (bodyParser.json())
  var sqlite3 = require('sqlite3') //.verbose ()
  const sqlitePromise = require ('sqlite3-promisify')
  const TransactionDatabase = require ("sqlite3-transactions").TransactionDatabase
  var setdb = new sqlite3.Database('_imdb_settings.sqlite')

  var sqlite = require ('sqlite') // This is sqlite3 'with await', 2019!

  //var jsdom = require('jsdom')
  //var dialog = require('nw-dialog')
  // Did never get jsdom or dialog to function

  // ----- C O M M O N S
  // ----- Upload counter
  let n_upl = 0
  // ----- mailSender/host/provider/smtpRelay for the contact function
  let mailsender = "savarhembygd@telia.com"
  // ----- Present work directory
  let PWD_PATH = path.resolve ('.')
  // ----- Image data(base) root directory
  let IMDB_ROOT = null // Must be set in route
  // ----- Image data(base) directory
  let IMDB_DIR = null // Must be set in route
  // ----- Name of symlink pointing to IMDB_ROOT
  let IMDB_LINK = "imdb"    // <<<<<<<<<< must equal init () setting!
  // ----- Base name of search result albums
  let picFound = ""
  // ----- Max lifetime (minutes) after last access of a search result album
  let toold = 60
  // ----- For debug data(base) directories
  let show_imagedir = false // for debugging

  let picLink = ""

  // ##### R O U T I N G  E N T R I E S
  // Remember to check 'Express route tester'!
  // ##### #0. General passing point
  app.all ('*', function (req, res, next) {
    if (show_imagedir) {
      console.log (" IMDB_DIR:", IMDB_DIR)
      console.log (req.params)
      console.log (req.hostname)
      console.log (req.originalUrl)
    }
    //console.log (process.memoryUsage ())
    // Check if this is a direct address to a picture (or an album?)

    //console.log ("PARAMS", req.params)
    if (req.body && req.body.like) {
      console.log("LIKE", req.body.like)
    }

    next () // pass control to the next handler
  })

  // ##### #0 00 Find in browser: .../find/<album>/<text items>
  app.get ('/:p([^/]+(/[^/]+)*)', function (req, res, next) {
    let p = req.params.p.toString ().split ("/")
    if (p [0] === "find") {
      var homeDir = imdbHome () // From env.var. $IMDB_HOME or $HOME
      IMDB_ROOT = p [1]
      setRootLink (homeDir, IMDB_ROOT, IMDB_LINK)
      // A few seconds cookie:
      if (!p [2]) p [2] = ""
      res.cookie (p [0], p [1] + "/" + p [2], {httpOnly: false, expires: new Date (Date.now () + 9000)})
      res.redirect ("../..")
      res.end ()
    } else {
      next ()
    }
  })

  // ##### #0.0 Get file access information
  app.get ('/wrpermission/:path', async function (req, res) {

    let file = req.params.path.replace (/@/g, "/").trim ()
    let r = fs.constants.R_OK
    let wr = fs.constants.W_OK | fs.constants.R_OK
    let acc = '' // No file(?)
    await fs.access (file, r, err => {
      if (!err) {
        acc = 'R' // Read permission
      }
    })
    await fs.access (file, wr, err => {
      if (!err) {
        acc = 'WR' // Write and read permission
      }
    })
    // It is not sufficient to use async/await (but necessary!)
    // Some delay is also required:
    setTimeout ( () => {
      res.send (acc)
    }, 100)
  })

  // ##### #0.1 Get file information
  app.get ('/filestat/:path', async function (req, res) {

    var LT = "se-SV" // Language tag for dateTime, environment locales are different!
    var missing = "uppgift saknas"
    var file = req.params.path.replace (/@/g, "/").trim ()
    var stat = fs.statSync (file)
    var lstat = fs.lstatSync (file)
    var linkto = ""
    var syml = await isSymlink (file)
    if (syml) {
      linkto = execSync ("readlink " + file).toString ().trim ()
      if (linkto [0] !== '.') {linkto = './' + linkto}
    }
    // Exclude the imdbLink name, nov 2019, in order to difficultize direct
    // access to the original pictures from the server. This could be made even
    // better, e.g., by selection of a random symlink name at program restart -
    // remember though, the database 'filepath' contains the imdbLink name!!!
    var filex = file.replace (/^[^/]+\//, "./")
    var fileStat = "<i>Filnamn</i>: " + filex + "<br><br>"
    if (linkto) {
      fileStat = "<i>Filnamn</i>: <span style='color:#0a4'>" + filex + "</span><br><br>"
      fileStat += "<i>Original</i>: " + linkto + "<br><br>"
    }
    fileStat += "<i>Storlek</i>: " + stat.size/1000000 + " Mb<br>"
    var tmp = execSync ("exif_dimension " + file).toString ().trim ()
    if (tmp === "missing") {tmp = missing}
    fileStat += "<i>Dimension</i>: " + tmp + "<br><br>"
    tmp = (new Date (execSync ("exif_dateorig " + file))).toLocaleString (LT, {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'})
    if (tmp.indexOf ("Invalid") > -1) {tmp = missing}
    fileStat += "<i>Fototid</i>: " + tmp + "<br>"
    fileStat += "<i>Ändrad</i>: " + stat.mtime.toLocaleString (LT, {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'}) + "<br>"
    res.send (fileStat)
  })

  // ##### #0.1.9 Set IMDB_ROOT and picFound basename
  app.get ('/imdbroot/:imdbroot', async function (req, res) {
    var homeDir = imdbHome () // From env.var. $IMDB_HOME or $HOME
    let p = req.params.imdbroot.trim ().split ("@")
    IMDB_ROOT = p [0]
    picFound = p [1]
    //console.log("0.1.9", homeDir, IMDB_ROOT, IMDB_LINK, picFound);
    // IMDB_LINK = symlink pointing to current album root
    setRootLink (homeDir, IMDB_ROOT, IMDB_LINK)
    await new Promise (z => setTimeout (z, 400))
    // Remove all too old picFound files
    let cmd = 'find -L ' + IMDB_LINK + ' -type d -name "' + picFound + '*" -amin +' + toold + ' | xargs rm -rf'
    //console.log (cmd);
    await cmdasync (cmd)
    res.send (true)
  })

  // ##### #0.2 Get IMDB_LINK directory list
  app.get ('/imdbdirs/:imdbroot', async function (req, res) {
    let homeDir = imdbHome () // From env.var. $IMDB_HOME or $HOME
    let p = req.params.imdbroot.trim ().split ("@")
    IMDB_ROOT = p [0]
    // picFoundx == picFound + random extension
    let picFoundx = p [1]
    // IMDB_LINK = symlink pointing to current albums
    setRootLink (homeDir, IMDB_ROOT, IMDB_LINK)
    await new Promise (z => setTimeout (z, 200))
    // Refresh picFoundx: the shell commands must execute in sequence
    let pif = IMDB_LINK + '/' + picFoundx
    let cmd = 'rm -rf ' + pif + ' && mkdir ' + pif + ' && touch ' + pif + '/.imdb'
    await cmdasync (cmd)
    // Remove all too old picFound files
    // We have to extract the picFound basename in case picFound is not yet defined
    if (!picFound) picFound = picFoundx.replace (/\..+$/, "")
    cmd = 'find -L ' + IMDB_LINK + ' -type d -name "' + picFound + '*" -amin +' + toold + ' | xargs rm -rf'
    await cmdasync (cmd)
    //console.log("0.2", cmd);
    setTimeout (function () {
      allDirs (IMDB_LINK).then (dirlist => {
        //console.log ("\n\na\n", dirlist)
        areAlbums (dirlist).then (async dirlist => {
          dirlist = dirlist.sort ()
          let dirtext = dirlist.join ("€")
          let dircoco = [] // directory content counter
          let dirlabel = [] // Album label thumbnail paths

          // Get all thumbnails and select
          // randomly one to be used as "subdirectory label"
          for (let i=0; i<dirlist.length; i++) {
            cmd = "echo -n `ls " + dirlist [i] + "/_mini_* 2>/dev/null`"
            //cmd = "echo -n `find " + dirlist [i] + ' -maxdepth 1 -type f,l -name "_mini_*" 2>/dev/null`'
            //let pics = execSync (cmd)
            let pics = await execP (cmd)
            pics = pics.toString ().trim ().split (" ")
            if (!pics [0]) {pics = []} // Remove a "" element
            let npics = pics.length
            if (npics > 0) {
              let f = () => {let d = new Date; return Number (d.getTime ().toString ().slice (-1))}
              let n = f () + 1
              let k = 0
              // Instead of seeding, loop n (1 to 10) times to get some variation:
              for (let i=0; i<n; i++) {
                k = (Math.random ()*npics)
              }
              var albumLabel = pics [Number (k.toString ().replace (/\..*/, ""))]
            } else {albumLabel = "€" + dirlist [i]}
            // Count the number of subdirectories
            let subs = occurrences (dirtext, dirlist [i]) - 1
            npics = " (" + npics + ")"
            if (i > 0 && subs) {npics += subs}
            dircoco.push (npics)
            dirlabel.push (albumLabel)
          }
//console.log("  dirlabel prel.:", dirlabel)
          for (let i=0; i<dirlist.length; i++) {
            var albumLabel
            if (dirlabel [i].slice (0, 1) === "€") {
              albumLabel = dirlabel [i].slice (1)
              dirlabel [i] = ""
              for (let j=i+1; j<dirlist.length; j++) {
                if (albumLabel === dirlabel [j].slice (0, albumLabel.length)) {
                  dirlabel [i] = dirlabel [j]
                  break
                }
              }
            }
//console.log(i,albumLabel,dirlabel[i])
          }

          let fd, ignorePaths = homeDir +"/"+ IMDB_ROOT + "/_imdb_ignore.txt"
          try { // Create _imdb_ignore.txt if missing
            fd = await fs.openAsync (ignorePaths, 'r')
            await fs.closeAsync (fd)
          } catch (err) {
            fd = await fs.openAsync (ignorePaths, 'w')
            await fs.closeAsync (fd)
          }
          // An _imdb_ignore line/path may/should start with just './' (if not #)
          let ignore = (await execP ("cat " + ignorePaths)).toString ().trim ().split ("\n")
          for (let j=0; j<ignore.length; j++) {
            for (let i=0; i<dirlist.length; i++) {
              if (ignore [j] && ignore [j].slice (0, 1) !== '#') {
                ignore [j] = ignore [j].replace (/^[^/]*/, IMDB_LINK)
                if (ignore [j] && dirlist [i].startsWith (ignore [j])) dircoco [i] += "*"
              }
            }
          }
//console.log("  dirtext:", dirtext)
//console.log("  dircoco:", dircoco)
//console.log("  dirlabel:", dirlabel)
          dirtext = dirtext.replace (/€/g, "\n")
          dircoco = dircoco.join ("\n")
          dirlabel = dirlabel.join ("\n")
          // NOTE: rootDir = homeDir + "/" + IMDB_ROOT, but here "@" separates them (important!):
          dirtext = homeDir +"@"+ IMDB_ROOT + "\n" + dirtext + "\nNodeJS " + process.version.trim ()
          res.location ('/')
          res.send (dirtext + "\n" + dircoco + "\n" + dirlabel)
          res.end ()
          console.log ('Directory information sent from server')
        })
      }).catch (function (error) {
        res.location ('/')
        res.send (error.message)
      })
    }, 1000)
  })

  // ##### #0.3 readSubdir to select rootdir...
  app.get ('/rootdir', function (req, res) {

    var homeDir = imdbHome ()
    readSubdir (homeDir).then (dirlist => {
//console.log("DIRLIST", dirlist)
      dirlist = dirlist.join ('\n')
      var tmp = execSync ("echo $IMDB_ROOT").toString ().trim ()
      if (dirlist.indexOf (tmp) < 0) {tmp = ""}
      dirlist = tmp + '\n' + dirlist
//console.log (dirlist)
      res.location ('/')
      res.send (dirlist)
      res.end ()
    })
    .catch ( (err) => {
      console.error ("RRR", err.message)
      res.location ('/')
      res.send (err.message)
    })
  })

  // ##### #0.4 Read file basenames
  app.get ('/basenames/:imagedir', (req, res) => {
    IMDB_DIR = req.params.imagedir.replace (/@/g, "/")
    findFiles (IMDB_DIR).then ( (files) => {
      var namelist = ""
      for (var i=0; i<files.length; i++) {
        var file = files [i].slice (IMDB_DIR.length)
        if (acceptedFileName (file) && !brokenLink (files [i])) {
          file = file.replace (/\.[^.]*$/, "") // Remove ftype
          namelist = namelist +'\n'+ file
        }
      }
      namelist = namelist.trim ()
      //console.log(namelist)
      res.location ('/')
      res.send (namelist)
      res.end ()
    }).catch (function (error) {
      res.location ('/')
      res.send (error.message)
    })
  })
  // ##### #0.5 Execute a shell command
  app.get ('/execute/:command', (req, res) => {
    //console.log(req.params.command)
    //console.log(decodeURIComponent (req.params.command))
    var cmd = decodeURIComponent (req.params.command).replace (/@/g, "/")
//console.log("Kommandolängd", cmd.length)
    try {
      // NOTE: execSync seems to use ``-ticks, not $()
      // Hence "`" don't pass if you don't escape them
      cmd = cmd.replace (/`/g, "\\`")
      var resdata = execSync (cmd)
//console.log ("execSync (" + cmd.trim ().replace (/(^[^ ]+ [^ ]+ [^ ]+).*/, "$1 ..."))
      res.location ('/')
      res.send (resdata)
      res.end ()
    } catch (err) {
      console.error ("`" + cmd + "`")
      console.error (err.message)
      res.location ('/')
      res.send (err.message)
    }
  })
  // ##### #0.6 Return user credentials
  app.get ('/login/:user', (req, res) => {
    var name = req.params.user
    var password = ""
    var status = "viewer"
    var allow = "?"
    try {
      setdb.serialize ( () => {
        //###  Uncomment the following to get a full user credentials log listout  ###//
        /*setdb.all ("SELECT name, pass, user.status, class.allow FROM user LEFT JOIN class ON user.status = class.status ORDER BY name;", (error,rows) => {
          if (!rows) {rows = []}
          console.log('----------------')
          for (var i=0; i<rows.length; i++) {
            console.log(rows [i].name, rows [i].pass, rows [i].status, rows [i].allow)
          }
          console.log('----------------')
        })*/
        setdb.get ("SELECT pass, status FROM user WHERE name = $name", {
          $name: name
        }, (error, row) => {
          if (error) {throw error}
          if (row) {
            password = row.pass
            status = row.status
          }
          // Must be nested, cannot be serialized (keeps 'status'):
          setdb.get ("SELECT allow FROM class WHERE status = $status", {
            $status: status
          }, (error, row) => {
            if (error) {throw error}
            if (row) {
              allow = row.allow
            }
            //console.log ("Login attempt " + name + " (" + status + ")")
            res.location ('/')
            res.send (password +"\n"+ status +"\n"+ allow)
            res.end ()
          })
        })
      })
    } catch (err) {
      res.location ('/')
      res.send (err.message)
    }
  })

  // ##### #1. Image list section using 'findFiles' with readdirAsync, Bluebird support
  app.get ('/imagelist/:imagedir', function (req, res) {
    // NOTE: Reset allfiles here, since it isn't refreshed by an empty album!
    allfiles = undefined
    // Note: A terminal '/' had been lost here, but not a terminal '@'! Thus, no need to add a '/':
    IMDB_DIR = req.params.imagedir.replace (/@/g, "/")
    if (show_imagedir) {
      console.log ("imagelist", req.params.imagedir, "=>", IMDB_DIR)
    }
    findFiles (IMDB_DIR).then (function (files) {
      if (!files) {files = []}
      var origlist = ''
      //files.forEach (function (file) { not recommended
      for (var i=0; i<files.length; i++) {
        var file = files [i]
        // Check the file name and that it is not a broken link: !`find <filename> xtype l`
        if (acceptedFileName (file.slice (IMDB_DIR.length)) && !brokenLink (file)) {
          origlist = origlist +'\n'+ file
        }
      }
      origlist = origlist.trim ()
      //console.log (" origlist=\n" + origlist);
      ////////////////////////////////////////////////////////
      // Get, check and package quadruple file names:
      //    [ 3 x relative-path, and simple-name ]   of
      //    [ origfile (without root-link-name, nov 2014),
      //                       showfile, minifile, nameonly ]
      // where the corresponding images will be sized (e.g.)
      //    [ full, 640x640, 150x150, -- ]   with file type
      //    [ image/*, png, png, -- ]   *(see application.hbs)
      // Four text lines represents an image's names
      ////////////////////////////////////////////////////////
      // Next to them, two '\n-free' metadata lines follow:
      // 5 Xmp.dc.description
      // 6 Xmp.dc.creator
      // 7 Last is '' or 'symlink'
      ////////////////////////////////////////////////////////
      // pkgfilenames prints initial console.log message
      //var pkgfilenamesWrap
      async function pkgfilenamesWrap () {
        await pkgfilenames (origlist).then ( () => {
          if (!allfiles) {allfiles = ''}
          res.location ('/')
          res.send (allfiles)
          res.end ()
          console.log ('...file information sent from server') // Remaining message
        }).catch (function (error) {
          res.location ('/')
          res.send (error.message)
        })
      }
      pkgfilenamesWrap ()
    })
  })

  // ##### #2. Get sorted file name list
  app.get ('/sortlist/:imagedir', function (req, res) {
    IMDB_DIR = req.params.imagedir.replace (/@/g, "/")
    if (show_imagedir) {
      console.log ("sortlist", req.params.imagedir, "=>", IMDB_DIR)
    }
    var imdbtxtpath = IMDB_DIR + '_imdb_order.txt'
    try {
      execSync ('touch ' + imdbtxtpath) // In case not yet created
    } catch (err) {
      res.location ('/')
      //res.send (err.message)
      res.send ("Error!") // Keyword!
      res.end ()
      console.log (IMDB_DIR + ' not found')
    }
    fs.readFileAsync (imdbtxtpath)
    .then (names => {
      //console.log (names) // <buffer>
      //??res.location ('/')
      res.send (names) // Sent buffer arrives as text
      res.end ()
      //console.log ('\n'+names.toString ()+'\n')
    }).then (console.info ('File order sent from server'))
  })

  // ##### #2.1 Get favorite images name list
  app.get ('/favorites/:imdbroot', function (req, res) {
    let favPath = imdbHome () + "/" + req.params.imdbroot.trim () + "/.imdb_favorites"
    try {
      execSync ('touch ' + favPath) // In case not yet created
    } catch (err) {
      res.location ('/')
      res.send ("Error!") // Keyword!
      res.end ()
      console.error ('Found no favorites')
    }
    fs.readFileAsync (favPath)
    .then (names => {
      res.send (names) // Sent buffer arrives as text
      res.end ()
    }).then (console.info ('Favorites list sent from server'))
  })

  // ##### #3. Get full-size (djvu?) file
  app.get ('/fullsize/*?', function (req, res) {
    var fileName = req.params[0] // with path
    //console.log (fileName)
    // Make a temporary .djvu file with the mkdjvu script
    // Plugins missing for most browsers January 2019
    //var tmpName = execSync ('mkdjvu ' + fileName)
    // Make a temporary png file instead (much bigger, sorry!)
    var tmpName = execSync ('mkpng ' + fileName)
    res.location ('/')
    res.send (tmpName)
    res.end ()
    console.log ('Started fullsize image generation')
  })

  // ##### #4. Download full-size original image file: Get the host name in responseURL
  app.get ('/download/*?', function (req, res) {
    var fileName = req.params[0] // with path
    console.log ('Download of ' + fileName + " initiated")
    res.location ('/')
    res.send (fileName)
  })

  // ##### #5. Delete an original file, or a symlink, and its mini and show files
  app.get ('/delete/*?', function (req, res) {
    res.location ('/')
    var fileName = req.params[0] // with path
    let tmp = rmPic (fileName)
    console.log (' ' + fileName + ' deleted')
    res.send (tmp) // tmp == 'DELETED'
    //await sqlUpdate (fileName) NOTE: done from refreshing via #6.5 sqlupdate
  })

  // ##### #6. START PAGE start page
  app.get ('/', function (req, res) {
    res.sendFile ('index.html', {root: PWD_PATH + '/public/'}) // load our index.html file
    // path must be "absolute or specify root to res.sendFile"
  })

  // ##### #6.5 Update one or more database entries
  app.post ('/sqlupdate', upload.none (), async function (req, res, next) {
    //console.log (req.body)
    let filepaths = req.body.filepaths
    //console.log ('SQLUPDATE', filepaths)
    let files = filepaths.trim ().split ('\n')
    for (let i=0; i<files.length; i++) {
      await new Promise (z => setTimeout (z, 888))
      await sqlUpdate (files [i])
    }
    res.location ('/')
    res.send ('')
    res.end ()
  })

  // ##### #6.6 Multiple shell commands executed using Bluebird promise mapSeries
  app.post ('/mexecute', upload.none (), function (req, res, next) {
    let cmds = req.body.cmds
    let commands = cmds.split ('\n')
    let results = []
    Promise.mapSeries (commands, function (cmd) { // mapSeries first tested here
      cmd = cmd.trim () // since \r may appear, why??
      execSync (cmd)
    }).then (function (results) {
      res.send ('')
    }, function (err) {
      res.send (err.message)
      console.error (err.message)
    })
  })

  // ##### #6.7 Send a mail message to admin
  app.post ('/contact', upload.none (), async function (req, res, next) {
    //let serveruser = await execP ("whoami")
    let title = req.body.title
    let username = req.body.username
    let picturename = req.body.picturename
    let mailtoadmin = req.body.mailtoadmin
    let from = req.body.from
    let email = req.body.email
    let message = req.body.message
    let cmd = "Mejl från:\r\n" + username + "/" + picturename + " " + from + "\r\n" + email + "\r\n" + message
    cmd = "message=" + "\"" + cmd.replace (/"/g, '\\"') + "\""
    cmd = cmd + "&& echo $message |mail -s \"" + title + "\" -r " + mailsender + " " + mailtoadmin
    await execP (cmd)
  })


  // ##### #7.1 Used by dropzone.js
  app.post ('/setimdbdir/:imagedir', function (req, res) {
    IMDB_DIR = req.params.imagedir.replace (/@/g, "/")
    res.send (IMDB_DIR)
    res.end ()
  })

  // ##### #7.2 Image upload, using Multer multifile and Bluebird promise upload
  // Called from the drop-zone component, NOTE: The name 'file' is mandatory!
  app.post ('/upload', upload.array ('file'), async function (req, res, next) {
    console.log ("IMDB_DIR =", IMDB_DIR)
    if (!IMDB_DIR) { // If not already set: refrain
      console.log ("Image directory missing, cannot upload")
      return
    }
    // ----- Image data base absolute path
    var IMDB_PATH = PWD_PATH + '/' + IMDB_DIR
    await Promise.mapSeries (req.files, function (file) { // Can we use mapSeries here?
      //console.log (JSON.stringify (file)) // the file object
      //console.log (file.originalname)
      console.log (file.path)
      file.originalname = file.originalname.replace (/ /g, "_") // Spaces prohibited
      //console.log (file.originalname)
      fs.readFileAsync (file.path)
      .then (contents => fs.writeFileAsync (IMDB_PATH + file.originalname, contents, 'binary'))
      .then (async () => {
        await new Promise (z => setTimeout (z, 888))
        await sqlUpdate (IMDB_DIR + file.originalname)
      }) // Add to the sql DB
      .then (console.log (++n_upl +' TMP: '+ file.path + ' written to' +'\nUPLOADED: '+ IMDB_DIR + file.originalname))
      // Delete showfile and minifile if the main file is refreshed
      .then(pngname = path.parse (file.originalname).name + '.png')
      .then (fs.unlinkAsync (IMDB_PATH +'_mini_'+ pngname)) // File not found isn't caught, see Express unhandledRejection!
      .then (fs.unlinkAsync (IMDB_PATH +'_show_'+ pngname)) // File not found isn't caught, see Express unhandledRejection!
      .then (res.send (file.originalname))
      //.then (console.log (' originalname: ' + file.originalname), res.send (file.originalname))
      .catch (function (error) {
        if (error.code === "ENOENT") {
          console.log ('FILE NOT FOUND:', IMDB_PATH + '_xxx_' + pngname)
        } else {
          // how to break the uploading???
          // res.status (500).end () // no effect, only console log shows up, if availible:
          console.log ('\033[31m' + n_upl +': '+ file.path + ' NO WRITE PERMISSION to' + '\n' + IMDB_PATH + file.originalname + '\033[0m')
        }
      })
    })
  })

  // ##### #8. Save the _imdb_order.txt file
  //           Called from the menu-buttons component's action.refresh
  app.post ('/saveorder/:imagedir', function (req, res, next) {
    IMDB_DIR = req.params.imagedir.replace (/@/g, "/")
    if (show_imagedir) {
      console.log ("saveorder", req.params.imagedir, "=>", IMDB_DIR)
    }
    var file = IMDB_DIR + "_imdb_order.txt"
    execSync ('touch ' + file) // In case not yet created
    var body = []
    req.on ('data', (chunk) => {
      //console.log(chunk)
      body.push (chunk) // body will be a Buffer array: <buffer 39 35 33 2c 30 ... >, <buf... etc.
    }).on ('end', () => {
      body = Buffer.concat (body).toString () // Concatenate; then change the Buffer into String
      // At this point, do whatever with the request body (now a string)
      //console.log("Request body =\n",body)
      fs.writeFileAsync (file, body).then (function () {
        console.log ("Saved file order ")
        //console.log ('\n'+body+'\n')
      })
      res.on('error', (err) => {
        console.error(err.message)
      })
      //res.connection.destroy()
      setTimeout (function () {
        res.sendFile ('index.html', {root: PWD_PATH + '/public/'}) // stay at the index.html file
      }, 200)
    })
  })

  // ##### #8.1 Save the .imdb_favorites file
  //            Called from the menu-buttons component's favorite dialog
  app.post ('/savefavor/:rootdir', function (req, res, next) {
    let file = imdbHome () + "/" + req.params.rootdir.trim () + "/.imdb_favorites"
    //console.log(8.1, file);
    var body = []
    req.on ('data', (chunk) => {
      body.push (chunk) // body will be a Buffer array: <buffer 39 35 33 2c 30 ... >, <buf... etc.
    }).on ('end', () => {
      //console.log(8.1, body);
      body = Buffer.concat (body).toString () // Concatenate; then change the Buffer into String
      //console.log(8.1, body);
      fs.writeFileAsync (file, body).then (function () {
        console.log ("Saved favorites ")
      })
      res.on('error', (err) => {
        console.error(err.message)
      })
      setTimeout (function () {
        res.sendFile ('index.html', {root: PWD_PATH + '/public/'}) // stay at the index.html file
      }, 200)
    })
  })

  // ##### #9. Save Xmp.dc.description and Xmp.dc.creator using exiv2
  app.post ('/savetext/:imagedir', function (req, res, next) {
    //console.log("Accessing 'app.post, savetext'")
    IMDB_DIR = req.params.imagedir.replace (/@/g, "/")
    // The above is superfluous and has, so far, no use here, since please note:
    // The imagedir directory path is already included in the file name here @***
    if (show_imagedir) {
      console.log ("savetext", req.params.imagedir, "=>", IMDB_DIR)
    }
    var body = []
    req.on ('data', (chunk) => {
      body.push (chunk)
    }).on ('end', () => {
      body = Buffer.concat (body).toString ()
      // Here `body` has the entire request body stored in it as a string
      var tmp = body.split ('\n')
      var fileName = tmp [0].trim () // the path is included here @***

      let okay = fs.constants.W_OK | fs.constants.R_OK
      fs.access (fileName, okay, async err => {
        if (err) {
          res.send ("Cannot write to " + fileName)
          console.log ('\033[31mNO WRITE PERMISSION to ' + fileName + '\033[0m')
        } else {
          console.log ('Xmp.dc metadata will be saved into ' + fileName)
          body = tmp [1].trim () // These trimmings are probably superfluous
          // The set_xmp_... command strings will be single quoted, avoiding
          // most Bash shell interpretation. Thus slice out 's within 's (cannot
          // be escaped just simply); makes Bash happy :) ('s = single quotes)
          body = body.replace (/'/g, "'\\''")
          //console7.log (fileName + " '" + body + "'")
          var mtime = fs.statSync (fileName).mtime // Object
          //console.log (typeof mtime, mtime)
          execSync ('set_xmp_description ' + fileName + " '" + body + "'") // for txt1
          body = tmp [2].trim () // These trimmings are probably superfluous
          body = body.replace (/'/g, "'\\''")
          //console.log (fileName + " '" + body + "'")
          if (fs.open)
          execSync ('set_xmp_creator ' + fileName + " '" + body + "'") // for txt2
          execSync ('touch -d "' + mtime + '" "' + fileName + '"')
          res.send ('')
          await new Promise (z => setTimeout (z, 888))
          await sqlUpdate (fileName) // with path @***
        }
      })
    })
    //res.sendFile ('index.html', {root: PWD_PATH + '/public/'}) // stay at the index.html file
  })

  // ##### #10. Search text, case insensitively, in _imdb_images.sqlite
  app.post ('/search/:imdbroot', upload.none (), function (req, res, next) {

    var homeDir = imdbHome () // From env.var. $IMDB_HOME or $HOME
    IMDB_ROOT = req.params.imdbroot.replace (/@/g, "/").trim ()
    // IMDB_LINK = Symlink pointing to current albums
    setRootLink (homeDir, IMDB_ROOT, IMDB_LINK)

    // Convert everything to lower case
    // The removeDiacritics funtion may bypass some characters (e.g. Sw. åäöÅÄÖ)
    let like = removeDiacritics (req.body.like).toLowerCase ()
    let cols = eval ("[" + req.body.cols + "]")
    //console.log ("SEARCH1", like) // SQL search items
    //console.log ("SEARCH2", cols) // Search colunns checkboxes
    let taco = ["description", "creator", "source", "album", "name"]
    let columns = ""
    for (let i=0; i<cols.length; i++) {
      if (cols [i]) {columns += "||" + taco [i]}
    }
    columns = columns.slice (2)
    //console.log ("SEARCH3", columns) // Search colunns names logic

    try { // Start try ----------
      let db = new sqlite3.Database (IMDB_LINK + '/_imdb_images.sqlite', function (err) {
        if (err) {
          console.error (err.message)
          res.send (err.message)
          res.end ()
        }
      })
      db.serialize ( () => {
        let sql = 'SELECT id, filepath, ' + columns + ' AS txtstr FROM imginfo WHERE ' + like
        db.all (sql, [], function (err, rows) {
          foundpath = ""
          if (rows) {
            tempstore = rows
            setTimeout ( () => {
              tempstore.forEach( (row) => {
                foundpath += row.filepath.trim () + "\n"
              })
              res.send (foundpath.trim ())
              res.end ()
            }, 1000)
          } else {
            err = "Error: The images database is out of order"
            console.error (err)
            res.send (err)
            res.end ()
          }
        })
        db.close ()
      })
    } catch (err) {
      console.error ("€RR", err.message)
    } // End try ----------

  })

  // ===== UNHANDLED REJECTIONS Express unhandledRejection
  process.on('unhandledRejection', (event) => {
    if (event.toString ().indexOf ('no such file') > 0) {
      return
    }
    console.log ('unhandledRejection, ' + event)
    return
  })

  let allfiles
  let foundpath
  let tempstore
  let recId

  // ===== COMMON FUNCTIONS

  // ===== Remove the files of a picture, filename with full web path
  //       (or deletes at least the primarily named file)
  function rmPic (fileName) {
    let pngname = path.parse (fileName).name + '.png'
    let IMDB_dir = path.parse (fileName).dir + '/'
    let IMDB_PATH = PWD_PATH + '/' + IMDB_dir
    fs.unlinkAsync (PWD_PATH + '/' + fileName) // File not found isn't caught!
    .then (sqlUpdate (fileName))
    .then (fs.unlinkAsync (IMDB_PATH +'_mini_'+ pngname)) // File not found isn't caught!
    .then (fs.unlinkAsync (IMDB_PATH +'_show_'+ pngname)) // File not found isn't caught!
    .then ()
    .catch (function (error) {
      let tmp = ''
      if (error.code === "ENOENT") {
        tmp = 'FILE NOT FOUND: ' + IMDB_PATH + '_xxx_' + pngname
        return tmp
      } else {
        tmp = 'NO PERMISSION to' + PWD_PATH + '/' + fileName
        tmp = '\033[31m' + tmp + '\033[0m'
        return tmp
// ??? HÄR BORDE EN STOR VARNING KOMMA FRAM FÖR TEXT TILL FEL USER -- varför det?
      }
    })
    return 'DELETED'
  }

  // ===== Check if a file is a symbolic link
  function isSymlink (file) {
    return new Promise (function (resolve, reject) {
      fs.lstat (file, function (err, stats) {
        if (err) {
          //console.error ('filestat isSymlink', err.message)
          resolve (false)
        } else {
          resolve (stats.isSymbolicLink ())
        }
      })
    })
  }

  // ===== Check and add|remove|update an image file record in the database
  // Se vidare  #0.1 Get file information  etc.
  // och #10. Search text  etc.
  // Funkar ej om 'filepaths' är mer än en fil ... (async hell)
  // NOTE: filepaths.length MUST be 1 only, caused by sync/async problem!

  // Kommentar den 2020-09-02 vid uppload-bekymmer:
  // Kanhända nya 'sqlite-async' på NPM kan förbättra? Också fenomenet att för 'hastigt
  // uppladdade' filer ibland inte hinner registreras: 'SQLITE_BUSY: database is locked'?

  function sqlUpdate (filepaths) {
  return new Promise (async function (resolve, reject) {
    let pathlist = filepaths.trim ().split ("\n")
    for (let i=0; i<pathlist.length; i++) { // forLoop
      let filePath = pathlist [i]
      // No files in the #picFound album (may be occasionally uploaded,
      // temporary, non-symlinks) nor any symlinks should be processed:
      if (filePath.indexOf (picFound) > 0 || await isSymlink (filePath)) continue;
      //console.log("sqlUpdate",filePath)
      // Classify the file as existing or not
      let pathArr = filePath.split ("/")
      let xmpParams = [], dbValues = {}
      let fileExists = false
      try {
        let fd = fs.openSync (filePath, 'r+')
        if (fd) {
          fileExists = true
          fs.closeSync (fd)
        }
      } catch (err) {
        fileExists = false
      }
      let db = await sqlite.open (IMDB_LINK + '/_imdb_images.sqlite')
      await db.run ("PRAGMA journal_mode=WAL")
      let sqlGetId = "SELECT id FROM imginfo WHERE filepath='" + filePath + "'"
      row = await db.get (sqlGetId)
      let recId = -1
      if (row) {recId = row ['id']}

      // Get metadata from the picture, 'lowercased':
      function getSqlParams () {
        let xmpkey = ['description', 'creator', 'source']
        for (let j=0; j<xmpkey.length; j++) {
          let cmd = 'xmpget ' + xmpkey [j] + ' ' + filePath
          // The removeDiacritics funtion may bypass some characters (e.g. Sw. åäöÅÄÖ)
          xmpParams [j] = removeDiacritics (execSync (cmd).toString ()).toLowerCase ()
        }
        dbValues =
        { $filepath:  filePath,
          $name:      pathArr [pathArr.length - 1].replace (/\.[^.]+$/, ""),
          $album:     removeDiacritics (filePath.replace (/^[^/]+(\/(.*\/)*)[^/]+$/, "$1")).toLowerCase (),
          $description: xmpParams [0],
          $creator:   xmpParams [1],
          $source:    xmpParams [2],
          $subject:   '',
          $tcreated:  '',
          $tchanged:  ''
        }
      }

      //console.log (" fileExists", fileExists, "recId", recId, i);

      if (recId > -1) { // in db table
        // RECORD 1 means that the database HAS a record
        // EXISTS 0 means that the image file does NOT exist
        // and the other way round ...

        if (fileExists) {
          /* RECORD 1  EXISTS 1
          ¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤ */
          //console.log (' sql UPDATE', recId, filePath)
          // update the table row where id = recId
          getSqlParams ()
          await db.run ('UPDATE imginfo SET (filepath,name,album,description,creator,source,subject,tcreated,tchanged) = ($filepath,$name,$album,$description,$creator,$source,$subject,$tcreated,$tchanged) WHERE id=' + recId, values = dbValues)

        } else {
          /* RECORD 1  EXISTS 0
          ¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤ */
          //console.log (' sql DELETE', recId, filePath)
          let sqlDelete = "DELETE FROM imginfo WHERE id=" + recId
          await db.run (sqlDelete)
        }

      } else { // not in db table

        if (fileExists) {
          /* RECORD 0  EXISTS 1
          ¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤ */
          //console.log (' sql INSERT', filePath)
          // insert a table row with filepath = filePath
          getSqlParams ()
          await db.run ('INSERT INTO imginfo (filepath,name,album,description,creator,source,subject,tcreated,tchanged) VALUES ($filepath,$name,$album,$description,$creator,$source,$subject,$tcreated,$tchanged)', values = dbValues)

        } else {
          /* RECORD 0  EXISTS 0
          ¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤ */
          //console.log (' sql NOOP', filePath)
          // do nothing
        } // if else
      } // if else
      await new Promise (z => setTimeout (z, 222))
      await db.close ()
    } // forLoop
    resolve (true)
  }) // Promise
  }

  // ===== Check if an album/directory name can be accepted
  function acceptedDirName (name) { // Note that &ndash; is accepted:
    let acceptedName = 0 === name.replace (/[/\-–@_.a-öA-Ö0-9]+/g, "").length && name !== IMDB_LINK
    return acceptedName && name.slice (0,1) !== "." && !name.includes ('/.')
  }

  // ===== Check if an image/file name can be accepted
  // Also, cf. 'acceptedFiles' in menu-buttons.hbs (for Dropbox/drop-zone)
  function acceptedFileName (name) {
    // This function must equal the acceptedFileName function in drop-zone.js
    var acceptedName = 0 === name.replace (/[-_.a-zA-Z0-9]+/g, "").length
    // Allowed file types are also set at drop-zone in the template menu-buttons.hbs
    var ftype = name.match (/\.(jpe?g|tif{1,2}|png|gif)$/i)
    var imtype = name.slice (0, 6) // System file prefix
    // Here more files may be filtered out depending on o/s needs etc.:
    return acceptedName && ftype && imtype !== '_mini_' && imtype !== '_show_' && imtype !== '_imdb_' && name.slice (0,1) !== "."
  }

  // ===== Read a directory's file content; in passing remove broken links
  function findFiles (dirName) {
    return fs.readdirAsync (dirName).map (function (fileName) { // Cannot use mapSeries here (why?)
      var filepath = path.join (dirName, fileName)
      var brli = brokenLink (filepath)
      if (brli) {
        rmPic (filepath) // may hopefully also work for removing any single file ...
        return path.join (path.dirname (filepath), ".ignore") // fake dotted file
      }
      return fs.statAsync (filepath).then (function (stat) {
        if (stat.mode & 0100000) {
          // See 'man 2 stat': S_IFREG bitmask for 'Regular file'
          return filepath
        } else {
          return path.join (path.dirname (filepath), ".ignore") // fake dotted file
        }
      })
    })
    .reduce (function (a, b) {
      //return a.concat (b)
      if (b) {a = a.concat (b)} // Discard undefined, probably from brokenLink check (?)
      return a
    }, [])
    .catch (err => {
      console.log("£RR", err.toString ())
    })
  }

  // ===== Read the dir's content of sub-dirs recursively (from https://gist.github.com/c0d0g3n)
  // Use: findDirectories('dir/to/search/in').then (dirlist => { ...
  //   Arg 'files' is used to propagate data of recursive calls to the initial call
  //   If you really want to, you can use arg 'files' to manually add some files to the result
  // Note: Order of results is not guaranteed due to the function's parallel nature
  /*findDirectories = async (dir, files = []) => {
    let items = await fs.readdirAsync (dir) // items are file || dir names
    //console.log('=====', items)
    return Promise.map (items, async (item) => {
      //let apitem = path.resolve (dir, item) // Absolute path
      item = path.join (dir, item) // Relative path
      if (!brokenLink (item)) {
        //console.log('~~~~~', item)
        let stat = await fs.statAsync (item)
        if (stat.isFile ()) {
          // item is file
          // do nothing
        } else if (stat.isDirectory ()) {
          // item is dir
          if (acceptedDirName (item)) {
            files.push (item)
            return findDirectories (item, files)
          }
        }
      }
    })
    .then ( () => {
      // every task is completed, provide results
      return files
    })
    .catch ( (err) => {
      console.log("ÆRR", err.toString ())
      return err.toString ()
    })
  }*/

  // ===== Read the imdbLink's content of sub-dirs recursively
  // Use: allDirs (imdbLink).then (dirlist => { ...
  // Replaces findDirectories (), NOTE: Includes imdbLink in the list!
  let allDirs = async imdbLink => {
    let IMDB_PATH = PWD_PATH + '/' + imdbLink
    let dirlist = await cmdasync ('find -L ' + IMDB_PATH + ' -type d|sort')
    dirlist = dirlist.toString ().trim () // Formalise string
    dirlist = dirlist.split ('\n')
    for (let i=0; i<dirlist.length; i++) {
      dirlist [i] = dirlist [i].slice (PWD_PATH.length + 1)
    }
    return dirlist
  }

  // ===== Remove from a directory path array each entry not pointing
  // to an album, which contains a file named '.imdb', and return
  // the remaining album directory list. NOTE: Both 'return's (*) are required!
  areAlbums = async (dirlist) => {
    let fd, albums = []
    return Promise.mapSeries (dirlist, async (album) => { // (*) // CAN use mapSeries here (why?)
      try {
        fd = await fs.openAsync (album + '/.imdb', 'r')
        await fs.closeAsync (fd)
        albums.push (album)
        /*try { // Create _imdb_ignore.txt if missing
          fd = await fs.openAsync (album + '/_imdb_ignore.txt', 'r')
          await fs.closeAsync (fd)
        } catch (err) {
          fd = fs.openSync (album + '/_imdb_ignore.txt', 'w')
          fs.closeSync (fd)
        }*/
      } catch (err) {
        // Ignore
      }
    }).then ( () => {
      return albums // (*)
    })
    .catch ( (err) => {
      console.error ("€RRR", err.message)
      return err.toString ()
    })
  }

  // ===== Read the dir's content of album sub-dirs (not recursively)
  readSubdir = async (dir, files = []) => {
    let items = await fs.readdirAsync (dir) // items are file || dir names
    return Promise.map (items, async (name) => { // Cannot use mapSeries here (why?)
      //let apitem = path.resolve (dir, name) // Absolute path
      let item = path.join (dir, name) // Relative path
      if (acceptedDirName (name) && !brokenLink (item)) {
        let stat = await fs.statAsync (item)
        if (stat.isDirectory ()) {
          let flagFile = path.join (item, '.imdb')
          let fd = await fs.openAsync (flagFile, 'r')
          if (fd > -1) {
            await fs.closeAsync (fd)
            files.push (name)
          }
        }
      }
    })
    .then (files, () => {
      return files
    })
    .catch ( (err) => {
      console.error ("€ARG", err.message)
      return err.toString ()
    })
  }

  // ===== Create minifile or showfile (note: size!), if non-existing
  // origpath = the file to be resized, filepath = the resized file
  async function resizefileAsync (origpath, filepath, size) {
    // Check if the file exists, then continue, but note (!): This openAsync will
    // fail if filepath is absolute. Needs web-rel-path to work ...
    fs.openAsync (filepath, 'r').then (async () => { // async!
      if (Number (fs.statSync (filepath).mtime) < Number (fs.statSync (origpath).mtime)) {
        await rzFile (origpath, filepath, size) // await!
      }
    })
    .catch (async function (error) { // async!
      // Else if it doesn't exist, make the resized file:
      if (error.code === "ENOENT") {
        await rzFile (origpath, filepath, size) // await!
      } else {
        console.error ('resizefileAsync', error.message)
        throw error
      }
    })
  }

  // ===== Use of ImageMagick: It is no longer true that
  // '-thumbnail' stands for '-resize -strip', perhaps darkens pictures ...
  // Note: All files except GIFs are resized into JPGs and thereafter
  // 'fake typed' PNG (resize into PNG is too difficult with ImageMagick).
  // GIFs are resized into GIFs to preserve their special properties.
  // The formal file extension PNG will still be kept for all resized files.
  async function rzFile (origpath, filepath, size) {
    var filepath1 = filepath // Is PNG as originally intended
    if (origpath.search (/gif$/i) > 0) {
      filepath1 = filepath.replace (/png$/i, 'gif')
    } else {
      filepath1 = filepath.replace (/png$/i, 'jpg')
    }
    var imckcmd
    imckcmd = "convert " + origpath + " -antialias -quality 80 -resize " + size + " -strip " + filepath1
    //console.log (imckcmd)
    exec (imckcmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`)
        return
      }
      if (filepath1 !== filepath) { // Rename to 'fake PNG'
        try {
          execSync ("mv " + filepath1 + " " + filepath)
        } catch (err) {
          console.error (err.message)
        }
      }
      console.log (' ' + filepath + ' created')
    })
    return
  }

  // ===== Get the image databases' root directory
  // The server environment should have $IMDB_HOME, else use $HOME
  function imdbHome () {
    var homeDir = execSync ("echo $IMDB_HOME").toString ().trim ()
    if (!homeDir || homeDir === "") {
      homeDir = execSync ("echo $HOME").toString ().trim ()
    }
    return homeDir
  }

  // ===== Make a package of orig, show, mini, and plain filenames, metadata, and symlink flag
  async function pkgfilenames (origlist) {
    if (origlist) {
      let files = origlist.split ('\n')
      allfiles = ''
      for (let file of files) {
        execSync ('pentaxdebug ' + file) // Pentax metadata bug fix is done here
        let pkg = await pkgonefile (file)
        allfiles += '\n' + pkg
      }
      console.log ('Showfiles•minifiles•metadata...')
      return allfiles.trim ()
    } else {
      return ''
    }
  }
  async function pkgonefile (file) {
    let origfile = file
    let symlink = await symlinkFlag (origfile)
    let fileObj = path.parse (origfile)
    let namefile = fileObj.name
    if (namefile.length === 0) {return null}
    let showfile = path.join (fileObj.dir, '_show_' + namefile + '.png')
    let minifile = path.join (fileObj.dir, '_mini_' + namefile + '.png')
    if (symlink !== 'symlink') {
      resizefileAsync (origfile, showfile, "'640x640>'")
      .then (resizefileAsync (origfile, minifile, "'150x150>'")).then ()
    } else {
      //let linkto = await cmdasync ("readlink " + origfile).then ().toString ().trim () // NOTE: Buggy, links badly, why, wrong syntax?
      let linkto = execSync ("readlink " + origfile).toString ().trim ()
      let linkObj = path.parse (linkto)

      await cmdasync ("ln -sfn " + linkObj.dir + "/" +"_show_"+ linkObj.name + ".png " + showfile)
      .then (
      await cmdasync ("ln -sfn " + linkObj.dir + "/" +"_mini_"+ linkObj.name + ".png " + minifile))
      .then ()

      /*linkto = path.dirname (linkto) // Extract path and create links:
      await cmdasync ("ln -sfn " + linkto + "/" + path.basename (showfile) + " " + showfile)
      .then (await cmdasync ("ln -sfn " + linkto + "/" + path.basename (minifile) + " " + minifile)).then ()*/
    }
    let cmd = []
    let tmp = '--' // Should never show up
    // Extract Xmp data with exiv2 scripts to \n-separated lines
    cmd [0] = 'xmp_description ' + origfile // for txt1
    cmd [1] = 'xmp_creator ' + origfile     // for txt2
    let txt12 = ''
    for (let _i = 0; _i< cmd.length; _i++) {
      tmp = "?" // Should never show up
      //tmp = execSync (cmd [_i])
      tmp = await cmdasync (cmd [_i])
      tmp = tmp.toString ().trim () // Formalise string
      if (tmp.length === 0) tmp = "-" // Insert fill character
      tmp = tmp.replace (/\n/g," ").trim () // Remove embedded \n(s)
      if (tmp.length === 0) tmp = "-" // Insert fill character
      txt12 = txt12 +'\n'+ tmp
    }
    // Triggers browser autorefresh but no meaning to refresh symlinks:
    let qrn = '?' + Math.random ().toString (36).substr (2,4)
    if (symlink === 'symlink') {qrn = ''}
    // origfile without root-link-name, nov 2014, e.g. imdb/aa/bb => aa/bb :
    return (origfile.replace (/^[^/]+\//, "") +'\n'+ showfile + qrn +'\n'+ minifile + qrn +'\n'+ namefile +'\n'+ txt12.trim () +'\n'+ symlink).trim () // NOTE: returns 7 rows
  }

  // ===== Make a shell command asyncronous
  let cmdasync = async (cmd) => {return execSync (cmd)}

  // ===== Is this file/directory a broken link? Returns its name or false
  // NOTE: Broken links may cause severe problems if not taken care of properly!
  brokenLink = item => {
    return execSync ("find '" + item + "' -maxdepth 0 -xtype l 2>/dev/null").toString ()
  }

  // ===== Return a symlink flag value
  function symlinkFlag (file) {
    return new Promise (function (resolve, reject) {
      fs.lstat (file, function (err, stats) {
        if (err) {
          console.error ('symlinkFlag', err.message)
        } else if (stats.isSymbolicLink ()) {
          resolve ('symlink')
        } else {
          resolve ('false')
        }
      })
    })
  }

  // ===== Point the symlink to the chosen album root directory
  function setRootLink (homeDir, IMDB_ROOT, imdbLink) {
    //console.log ("\nIMDB_HOME:", homeDir)
    if (!IMDB_ROOT || IMDB_ROOT === "") {IMDB_ROOT = execSync ("echo $IMDB_ROOT").toString ().trim ()}
    if (IMDB_ROOT === "undefined") {IMDB_ROOT = "/"}
    //console.log ("IMDB_ROOT:", IMDB_ROOT)
    // Establish the symlink to the chosen album root directory
    execSync ("ln -sfn " + homeDir + "/" + IMDB_ROOT + " " + imdbLink)
    // Confirm:
    let rootDir = execSync ("readlink " + imdbLink).toString ().trim ()
    //console.log ("Path to '" + imdbLink + "': " + rootDir)
  }
}
// End module.exports

function pause (ms) { // or use 'await new Promise (z => setTimeout (z, 2000))'
  console.log('pause',ms)
  return new Promise (done => setTimeout (done, ms))
}
// SQL för att göra lista på dubletter, kanske för att göra PDF med Pdfkit?
// Ska kanske läggas till: ... + " ESCAPE '\'" ?
//SELECT a.name, a.filepath FROM imginfo a JOIN (SELECT name, COUNT(*), filepath FROM imginfo GROUP BY name HAVING COUNT(*) > 1) b ON a.name = b.name ORDER BY a.name;
// Eller enklare: SELECT name, COUNT(*) FROM imginfo GROUP BY name HAVING COUNT(*) > 1 ORDER BY name;
// ===== GLOBALS

// Data for the removeDiacritics function (see below)
// modified to not affect 'removed' characters:
const defaultDiacriticsRemovalMap = [
  {'base':'A', 'letters':'\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u01DE\u1EA2\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F'}, // removed Ä \u00C4, Å \u00C5
  {'base':'AA','letters':'\uA732'},
  {'base':'AE','letters':'\u00C6\u01FC\u01E2'},
  {'base':'AO','letters':'\uA734'},
  {'base':'AU','letters':'\uA736'},
  {'base':'AV','letters':'\uA738\uA73A'},
  {'base':'AY','letters':'\uA73C'},
  {'base':'B', 'letters':'\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181'},
  {'base':'C', 'letters':'\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E'},
  {'base':'D', 'letters':'\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779\u00D0'},
  {'base':'DZ','letters':'\u01F1\u01C4'},
  {'base':'Dz','letters':'\u01F2\u01C5'},
  {'base':'E', 'letters':'\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E'},
  {'base':'F', 'letters':'\u0046\u24BB\uFF26\u1E1E\u0191\uA77B'},
  {'base':'G', 'letters':'\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E'},
  {'base':'H', 'letters':'\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D'},
  {'base':'I', 'letters':'\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197'},
  {'base':'J', 'letters':'\u004A\u24BF\uFF2A\u0134\u0248'},
  {'base':'K', 'letters':'\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2'},
  {'base':'L', 'letters':'\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780'},
  {'base':'LJ','letters':'\u01C7'},
  {'base':'Lj','letters':'\u01C8'},
  {'base':'M', 'letters':'\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C'},
  {'base':'N', 'letters':'\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4'},
  {'base':'NJ','letters':'\u01CA'},
  {'base':'Nj','letters':'\u01CB'},
  {'base':'O', 'letters':'\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C'}, // removed Ö \u00D6
  {'base':'OI','letters':'\u01A2'},
  {'base':'OO','letters':'\uA74E'},
  {'base':'OU','letters':'\u0222'},
  {'base':'OE','letters':'\u008C\u0152'},
  {'base':'oe','letters':'\u009C\u0153'},
  {'base':'P', 'letters':'\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754'},
  {'base':'Q', 'letters':'\u0051\u24C6\uFF31\uA756\uA758\u024A'},
  {'base':'R', 'letters':'\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782'},
  {'base':'S', 'letters':'\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784'},
  {'base':'T', 'letters':'\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786'},
  {'base':'TZ','letters':'\uA728'},
  {'base':'U', 'letters':'\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244'},
  {'base':'V', 'letters':'\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245'},
  {'base':'VY','letters':'\uA760'},
  {'base':'W', 'letters':'\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72'},
  {'base':'X', 'letters':'\u0058\u24CD\uFF38\u1E8A\u1E8C'},
  {'base':'Y', 'letters':'\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE'},
  {'base':'Z', 'letters':'\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762'},
  {'base':'a', 'letters':'\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u01DF\u1EA3\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250'}, // removed ä \u00E4, å \u00E5
  {'base':'aa','letters':'\uA733'},
  {'base':'ae','letters':'\u00E6\u01FD\u01E3'},
  {'base':'ao','letters':'\uA735'},
  {'base':'au','letters':'\uA737'},
  {'base':'av','letters':'\uA739\uA73B'},
  {'base':'ay','letters':'\uA73D'},
  {'base':'b', 'letters':'\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253'},
  {'base':'c', 'letters':'\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184'},
  {'base':'d', 'letters':'\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A'},
  {'base':'dz','letters':'\u01F3\u01C6'},
  {'base':'e', 'letters':'\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD'},
  {'base':'f', 'letters':'\u0066\u24D5\uFF46\u1E1F\u0192\uA77C'},
  {'base':'g', 'letters':'\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F'},
  {'base':'h', 'letters':'\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265'},
  {'base':'hv','letters':'\u0195'},
  {'base':'i', 'letters':'\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131'},
  {'base':'j', 'letters':'\u006A\u24D9\uFF4A\u0135\u01F0\u0249'},
  {'base':'k', 'letters':'\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3'},
  {'base':'l', 'letters':'\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747'},
  {'base':'lj','letters':'\u01C9'},
  {'base':'m', 'letters':'\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F'},
  {'base':'n', 'letters':'\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5'},
  {'base':'nj','letters':'\u01CC'},
  {'base':'o', 'letters':'\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275'}, // removed ö \u00F6
  {'base':'oi','letters':'\u01A3'},
  {'base':'ou','letters':'\u0223'},
  {'base':'oo','letters':'\uA74F'},
  {'base':'p','letters':'\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755'},
  {'base':'q','letters':'\u0071\u24E0\uFF51\u024B\uA757\uA759'},
  {'base':'r','letters':'\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783'},
  {'base':'s','letters':'\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B'},
  {'base':'t','letters':'\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787'},
  {'base':'tz','letters':'\uA729'},
  {'base':'u','letters': '\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289'},
  {'base':'v','letters':'\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C'},
  {'base':'vy','letters':'\uA761'},
  {'base':'w','letters':'\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73'},
  {'base':'x','letters':'\u0078\u24E7\uFF58\u1E8B\u1E8D'},
  {'base':'y','letters':'\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF'},
  {'base':'z','letters':'\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763'}
];
let diacriticsMap = {};
for (let i=0; i < defaultDiacriticsRemovalMap .length; i++){
  let letters = defaultDiacriticsRemovalMap [i].letters;
  for (let j=0; j < letters.length ; j++){
    diacriticsMap[letters[j]] = defaultDiacriticsRemovalMap [i].base;
  }
}
function removeDiacritics (str) {
  return str.replace(/[^\u0000-\u007E]/g, function(a){
    return diacriticsMap[a] || a;
  });
}
/** Function that counts occurrences of a substring in a string;
 * @param {String} string               The string
 * @param {String} subString            The substring to search for
 * @param {Boolean} [allowOverlapping]  Optional. (Default:false)
 *
 * @author Vitim.us https://gist.github.com/victornpb/7736865
 * @see Unit Test https://jsfiddle.net/Victornpb/5axuh96u/
 * @see http://stackoverflow.com/questions/4009756/how-to-count-string-occurrence-in-string/7924240#7924240
 */
function occurrences(string, subString, allowOverlapping) {
  string += "";
  subString += "";
  if (subString.length <= 0) return (string.length + 1);

  var n = 0,
    pos = 0,
    step = allowOverlapping ? 1 : subString.length;

  while (true) {
    pos = string.indexOf(subString, pos);
    if (pos >= 0) {
      ++n;
      pos += step;
    } else break;
  }
//console.log(subString, n);
  return n;
}
