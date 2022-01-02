/* eslint-disable no-console */
/* global Dropzone*/
import Component from '@ember/component'
import $ from 'jquery';
// eslint-disable-next-line no-unused-vars
//import Ember from 'ember';
import { later } from '@ember/runloop';
//import { on } from '@ember/object/evented';
import { Promise } from 'rsvp';

export default Component.extend({
  classNames: ['dropzone'],

  myDropzone: () => {return document.body || undefined},

  dropzoneOptions: null,

  // Configuration Options

  url: null,
  withCredentials: null,
  method: 'POST',
  parallelUploads: 1,  // <= must be ONE if run with PM2 in cluster mode!
  maxFilesize: null,
  filesizeBase: null,
  paramName: null,
  uploadMultiple: null,
  headers: () => {return {}},
  addRemoveLinks: true,
  previewsContainer: null,
  clickable: null,
  maxThumbnailFilesize: null,
  thumbnailWidth: 100,
  thumbnailHeight: 100,
  maxFiles: null,
  createImageThumbnails: null,

  // resize: not available
  acceptedFiles: 'image/*',
  autoProcessQueue: null,
  forceFallback: null,
  previewTemplate: null,

  // Dropzone translations
  dictDefaultMessage: 'FÖR ATT LADDA UPP BILDER: SLÄPP DEM HÄR ELLER KLICKA...' ,
  dictFallbackMessage: null,
  dictFallbackText: null,
  dictInvalidFileType: null,
  dictFileTooBig: null,
  dictResponseError: "Serverrespons: Kod = {{statusCode}}",
  dictCancelUpload: null,
  dictCancelUploadConfirmation: null,
  dictRemoveFile: 'Ta bort',
  dictMaxFilesExceeded: null,
//dictDefaultMessage: "Drop files here to upload",
//dictFallbackMessage: "Your browser does not support drag'n'drop file uploads.",
//dictFallbackText: "Please use the fallback form below to upload your files like in the olden days.",
//dictFileTooBig: "File is too big ({{filesize}}MiB). Max filesize: {{maxFilesize}}MiB.",
//dictInvalidFileType: "You can't upload files of this type.",
//dictResponseError: "Server responded with {{statusCode}} code.",
//dictCancelUpload: "Cancel upload",
//dictCancelUploadConfirmation: "Are you sure you want to cancel this upload?",
//dictRemoveFile: "Remove file",
//dictRemoveFileConfirmation: null,
//dictMaxFilesExceeded: "You can not upload any more files.",

  // Bonus for full screen zones
  maxDropRegion: null,

  // Events

  // All of these receive the event as first parameter:
  drop: null,
  dragstart: null,
  dragend: null,
  dragenter: null,
  dragover: null,
  dragleave: null,

  // All of these receive the file as first parameter:
  addedfile: null,
  removedfile: null,
  thumbnail: null,
  error: null,
  processing: null,
  uploadprogress: null,
  sending: null,
  success: null,
  complete: null,
  canceled: null,
  maxfilesreached: null,
  maxfilesexceeded: null,

  // All of these receive a list of files as first parameter and are only called if the uploadMultiple option is true:
  processingmultiple: null,
  sendingmultiple: null,
  successmultiple: null,
  completemultiple: null,
  canceledmultiple: null,

  // Special events:
  totaluploadprogress: null,
  reset: null,
  queuecomplete: null,
  files: null,

  // Callback functions
  accept: null,

  setEvents() {
    let myDropzone = this.get('myDropzone');
    let events = {
      drop: this.drop,
      dragstart: this.dragstart,
      dragend: this.dragend,
      dragenter: this.dragenter,
      dragover: this.dragover,
      dragleave: this.dragleave,
      addedfile: this.addedfile,
      removedfile: this.removedfile,
      thumbnail: this.thumbnail,
      error: this.error,
      processing: this.processing,
      uploadprogress: this.uploadprogress,
      sending: this.sending,
      success: this.success,
      complete: this.complete,
      canceled: this.canceled,
      maxfilesreached: this.maxfilesreached,
      maxfilesexceeded: this.maxfilesexceeded,
      processingmultiple: this.processingmultiple,
      sendingmultiple: this.sendingmultiple,
      successmultiple: this.successmultiple,
      completemultiple: this.completemultiple,
      canceledmultiple: this.canceledmultiple,
      totaluploadprogress: this.totaluploadprogress,
      reset: this.reset,
      queuecomplete: this.queuecomplete,
      files: this.files,
      accept: this.accept,
    };

    for (let e in events) {
      if (events[e] !== null) {
        myDropzone.on(e, events[e]);
      }
    }
  },

  getDropzoneOptions() {
    const onDragEnterLeaveHandler = function(dropzoneInstance) {
      const onDrag = ( element => {
        let dragCounter = 0;

        return {
          enter(event) {
            event.preventDefault();
            dragCounter++;
            element.classList.add('dz-drag-hover');
          },
          leave() {
            dragCounter--;

            if (dragCounter === 0) {
              element.classList.remove('dz-drag-hover');
            }
          }
        };
      }).call(this, dropzoneInstance.element);

      dropzoneInstance.on('dragenter', onDrag.enter);
      dropzoneInstance.on('dragleave', onDrag.leave);
    };

    let dropzoneOptions = {};
    let dropzoneConfig = {
      url: this.url,
      withCredentials: this.withCredentials,
      method: this.method,
      parallelUploads: this.parallelUploads,
      maxFilesize: this.maxFilesize,
      filesizeBase: this.filesizeBase,
      paramName: this.paramName,
      uploadMultiple: this.uploadMultiple,
      headers: this.headers,
      addRemoveLinks: this.addRemoveLinks,
      previewsContainer: this.previewsContainer,
      clickable: this.clickable,
      maxThumbnailFilesize: this.maxThumbnailFilesize,
      thumbnailWidth: this.thumbnailWidth,
      thumbnailHeight: this.thumbnailHeight,
      maxFiles: this.maxFiles,
      createImageThumbnails: this.createImageThumbnails,

      // resize: not available
      acceptedFiles: this.acceptedFiles,
      autoProcessQueue: this.autoProcessQueue,
      forceFallback: this.forceFallback,
      previewTemplate: this.previewTemplate,

      // Dropzone translations
      dictDefaultMessage: this.dictDefaultMessage,
      dictFallbackMessage: this.dictFallbackMessage,
      dictFallbackText: this.dictFallbackText,
      dictInvalidFileType: this.dictInvalidFileType,
      dictFileTooBig: this.dictFileTooBig,
      dictResponseError: this.dictResponseError,
      dictCancelUpload: this.dictCancelUpload,
      dictCancelUploadConfirmation: this.dictCancelUploadConfirmation,
      dictRemoveFile: this.dictRemoveFile,
      dictMaxFilesExceeded: this.dictMaxFilesExceeded,

      // Fix flickering dragging over child elements: https://github.com/enyo/dropzone/issues/438
      dragenter: this.noop,
      dragleave: this.noop,
      init: function () {
        onDragEnterLeaveHandler(this);
        document.getElementById("uploadWarning").style.display = "none";
        this.on("addedfile", function(file) {
          $ ("#uploadFinished").text ("");
          document.getElementById("uploadPics").style.display = "inline";
          document.getElementById("removeAll").style.display = "inline";
          //$ ("#uploadFinished").text ("");
          if (acceptedFileName (file.name)) {
            var namepic = file.name.replace (/.[^.]*$/, "");
            // escapeDots <=> .replace (/\./g, "\\.") NEEDED since jQuery uses CSS:
            if ($ ("#i" + namepic.replace (/\./g, "\\.")).length > 0) { // If already present in the DOM, upload would replace that file, named equally
              $ ("#uploadWarning").html ("&nbsp;VARNING FÖR ÖVERSKRIVNING: Lika filnamn finns redan!&nbsp;");
              document.getElementById("uploadWarning").style.display = "inline";
              console.log (namepic, file.type, file.size, "ALREADY PRESENT");
              //console.log(file.previewElement.classList);
              file.previewElement.classList.add ("picPresent");
              //console.log(JSON.stringify (file.previewElement.classList));
              document.getElementById("removeDup").style.display = "inline";
            } else { // New file to upload
              console.log (namepic, file.type, file.size, "NEW");
            }
          } else {
            console.log ("Illegal file name: " + file.name);
            // userLog() unreachable
            $ ("#uploadFinished").html ('<span style="color:deeppink">OTILLÅTET FILNAMN<br>' + file.name + "</span>");
            later ( () => {
              file.previewElement.querySelector ("a.dz-remove").click ();
            }, 1000);
          }
        });

        this.on("removedfile", function() {
          if ($ ("div.dz-preview.picPresent a.dz-remove").length < 1) {
            document.getElementById("uploadWarning").style.display = "none";
            document.getElementById("removeDup").style.display = "none";
          }
        });

        this.on("reset", function() {
          document.getElementById("uploadPics").style.display = "none";
          document.getElementById("removeAll").style.display = "none";
          document.getElementById("uploadWarning").style.display = "none";
          document.getElementById("removeDup").style.display = "none";
          $ ("#uploadFinished").text ("");
        });

        this.on("queuecomplete", function() {
          document.getElementById("uploadPics").style.display = "none";
          document.getElementById("uploadWarning").style.display = "none";
          $ ("#uploadFinished").text ("UPPLADDNINGEN FÄRDIG");
          this.options.autoProcessQueue = false;
          let n = this.files.length;
          console.log (secNow (), "drop-zone queuecomplete"); // Upload end
          // Refresh after file upload
          var ms = n * 1000; // May be a setting?
          (function (t) {
            setTimeout (function () {
              $ ("img.spinner").trigger ("click");
              later ( () => {
                $ ("#reFr").trigger ("click");
              }, 222);
            }, (t)); // Waiting time
          })(ms); //Pass milliseconds into closure of self-exec anon-func
          later ( () => {
            // Mark the uploaded files
            for (let i=0; i<n; i++) {
              // This local 'name' is 1) without extension 2) with escaoed dots if any
              let name = this.files [i].name.replace (/\.[^.]*$/, "").replace (/\./g, "\\.");
              $ ("#i" + name + " div[alt='MARKER']").removeClass ();
              $ ("#i" + name + " div[alt='MARKER']").addClass ("markTrue");
            }
            later ( () => { // Reveal obscured uploads
              $ ("div.miniImgs").trigger ("click");
            }, 222);
          }, 2*ms);
        });

      }
    };

    for (let option in dropzoneConfig) {
      let data = dropzoneConfig[option];
      if (data !== null) {
        dropzoneOptions[option] = data;
      } else if (option === 'thumbnailHeight' || option === 'thumbnailWidth') {
        dropzoneOptions[option] = data;
      }
    }

    this.set('dropzoneOptions', dropzoneOptions);
  },

  createDropzone (element) {
    let region = this.get('maxDropRegion') ? document.body : element;
    this.set('myDropzone', new Dropzone(region, this.dropzoneOptions));
  },

  //insertDropzone: Ember.on('didInsertElement', function() {
  didInsertElement () {
    let _this = this;
    this.getDropzoneOptions();
    Dropzone.autoDiscover = false;
    this.createDropzone(this.element);
    //make sure events are set before any files are added
    this.setEvents();

    //this condition requires a fully resolved array to work
    //will not work with model.get('files') as it returns promise not array hence length condition is failed
    if (this.files && this.files.length > 0) {
      this.files.map(function(file) {
        let dropfile = {
          name: file.get('name'),
          type: file.get('type'),
          size: file.get('size'),
          status: Dropzone.ADDED,
          //add support for id  in files object so it can be access in addedFile,removedFile callbacks for files identified by id
          id: file.get('id')
        };
        let thumbnail = file.get('thumbnail');

        if (typeof (thumbnail) === 'string') {
          dropfile.thumbnail = thumbnail;
        }

        _this.myDropzone.emit('addedfile', dropfile);

        if (typeof (thumbnail) === 'string') {

          _this.myDropzone.emit('thumbnail', dropfile, thumbnail);
        }

        _this.myDropzone.emit('complete', dropfile);
        _this.myDropzone.files.push(file);
      });
    }

    return this.myDropzone;
  },

  actions: {
    closeThis() {
      document.getElementById ("divDropbox").style.display = "none";
    },

    removeAllFiles() {
      this.myDropzone.removeAllFiles();
      document.getElementById("removeAll").style.display = "none";
      document.getElementById("removeDup").style.display = "none";
      document.getElementById("uploadWarning").style.display = "none";
    },

    removeDupFiles() {
      //this.myDropzone.removeAllFiles();
      var dupEl = $ ("div.dz-preview.picPresent a.dz-remove");
      for (var i=0; i<dupEl.length; i++) {
        dupEl [i].click ();
      }
      //this.userLog ("REMOVED", dupEl.length); unreachable!
      document.getElementById("removeDup").style.display = "none";
      document.getElementById("uploadWarning").style.display = "none";
    },

    processQueue() {
      return new Promise ( () => {
        this.myDropzone.options.autoProcessQueue = false;
        qlen = this.myDropzone.getQueuedFiles().length;
        if (qlen > 0) {
          $ (".spinner").show ();
          document.getElementById("reLd").disabled = true;
          document.getElementById("saveOrder").disabled = true;
          document.getElementById("showDropbox").disabled = true;
          this.myDropzone.options.autoProcessQueue = true;
          console.log (secNow (), "drop-zone processQueue:", qlen); // Upload begin
          this.myDropzone.processQueue ();
        }
      }).then ( () => {
        // Kanske här?
      });
      /*setImdbDir ().then (imdbDir => { // Ensure the server imdbDir is set!
        if (imdbDir) {
        }
      });*/
    }

  },

});
var qlen = 0; // Queue length

function secNow () { // Local time stamp in milliseconds
  let tmp = new Date ();
  return tmp.toLocaleTimeString () + "." + ("00" + tmp.getMilliseconds ()).slice (-3);
}

function acceptedFileName (name) {
  // This function must equal the acceptedFileName function in routes.js
  var acceptedName = 0 === name.replace (/[-_.a-zA-Z0-9]+/g, "").length
  // Allowed file types are also set at drop-zone in the template menu-buttons.hbs
  var ftype = name.match (/\.(jpe?g|tif{1,2}|png|gif)$/i)
  var imtype = name.slice (0, 6) // System file prefix
  // Here more files may be filtered out depending on o/s needs etc.:
  return acceptedName && ftype && imtype !== '_mini_' && imtype !== '_show_' && imtype !== '_imdb_' && name.slice (0,1) !== "."
}

/*function setImdbDir () { // Set the server imdbDir
  return new Promise ( (resolve, reject) => {
    later ( () => { // Wait in case imdbDir is changing
      var IMDB_DIR = $ ('#imdbDir').text ();
      if (IMDB_DIR.slice (-1) !== "/") {IMDB_DIR = IMDB_DIR + "/";}
      IMDB_DIR = IMDB_DIR.replace (/\//g, "@"); // For sub-directories
      var xhr = new XMLHttpRequest ();
      xhr.open ('POST', 'setimdbdir/' + IMDB_DIR); // URL matches server-side routes.js
      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          let dirSet = xhr.responseText;
          resolve (dirSet);
        } else {
          console.log ('setimdbdir/setImdbDir error');
          reject ({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.send ();
    }, 4);
  }).catch (error => {
    console.error (error.message);
  });
}*/
