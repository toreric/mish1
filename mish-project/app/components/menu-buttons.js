/* eslint-disable no-console */
/* eslint ember/avoid-leaking-state-in-ember-objects: "off" */
// (cannot use ember-context-menu with the 'leaking-state' rule)
import Component from '@ember/component'
import EmberObject from '@ember/object';
import { Promise } from 'rsvp';
import $ from 'jquery';
import { later } from '@ember/runloop';
import Ember from 'ember';
import { htmlSafe } from '@ember/string';
import { task } from 'ember-concurrency';
import contextMenuMixin from 'ember-context-menu';
export default Component.extend (contextMenuMixin, {

  // TEMPLATE PERFORM tasks, reachable from the HTML template page
  /////////////////////////////////////////////////////////////////////////////////////////

  rstBrdrs: task (function* () {
    if ($ (".mainMenu").is (":visible")) {
      // Close this if visible:
      $ (".mainMenu").hide ();
    } else {
      resetBorders ();
    }
    yield null; // required
  }),

  requestDirs: task (function* () {
    let imdbroot = this.get ("imdbRoot");
    document.title = "Mish";
    if (imdbroot === "") {

      let rootList = $ ("#imdbRoots").text (); // Amendment after move to 'init ()'
      if (!rootList) rootList = yield reqRoot (); //  First, get possible rootdirs ((1))
      if (rootList) {
        rootList = rootList.split ("\n");
        let seltxt = rootList [0];
        rootList.splice (0, 1, "");
        rootList [0] = "Välj albumkatalog "; // i18n, must have a space
        let selix = rootList.indexOf (seltxt);
        if (selix > 0) {
          this.set ("imdbRoot", seltxt);
          $ ("#imdbRoot").text (seltxt);
          imdbroot = seltxt;
        }
        this.set ("imdbRoots", rootList);
        rootList = rootList.join ("\n");
        $ ("#imdbRoots").text (rootList);
      }

      if (imdbroot === "") {
        // Prepare to select imdbRoot
        $ (".mainMenu").show ();
        $ ("iframe").hide ();
        $ (".mainMenu p:gt(1)").hide (); // Shown at selectRoot ()
        this.set ("albumData", [])
//==        spinnerWait (false);
        //spinnerWait (true);
        return;
      }
    }

    document.title = "Mish: " + removeUnderscore (imdbroot, true);
    //yield reqDirs (imdbroot); // Request all subdirs recursively ((2))
    // MUST BE POSTPONED UNTIL imdLink is server-established!

    if (this.get ("albumData").length === 0) {
      yield reqDirs (imdbroot); // Then request subdirectories recursively ((2))
    }

    this.set ("userDir", $ ("#userDir").text ());
    this.set ("imdbRoot", $ ("#imdbRoot").text ());
    this.set ("imdbDirs", $ ("#imdbDirs").text ().split ("\n"));
    this.set ("imdbLink", $ ("#imdbLink").text ());

    if (this.get ("albumData").length === 0) {
      // Construct dirList|treePath for jstree data = albumData
      let treePath = this.get ("imdbDirs");
      let imdbLink = this.get ("imdbLink");
      for (var i=0; i<treePath.length; i++) {
        if (i === 0) {treePath [i] = imdbLink;} else {
          treePath [i] = imdbLink + treePath [i].toString ();
        }
      }
      let albDat = aData (treePath);
      // Substitute the first name (in '{text:"..."') into the root name:
      albDat = albDat.split (","); // else too long a string (??)
      albDat [0] = albDat [0].replace (/{text:".*"/, '{text:"' + ' <span style=\'font-family:Arial;font-weight:bold;font-size:80%\'>ROT: </span>" + this.get ("imdbRoot")');

      //              let txt = $("#j1_1_anchor").html ();
      //              $("#j1_1_anchor").html (txt + ' (<span style="font:bold Verdana">ROT</span>)');

      albDat = albDat.join (",");
      let count = $ ("#imdbCoco").html ().split ("\n");
      for (let i=0; i<count.length; i++) {
        albDat = albDat.replace (/{text:"([^" ]*)"/, "{text:€$1<small>" + count[i + 1] + "</small>\"");
      }
      albDat = albDat.replace (/€/g, '"');
      this.set ("albumData", eval (albDat));
      if (tempStore) { // This is not in use (?) ... too sophisticated ...
        //alert ('75 tempStore true'); // borde testa här hur det är ^^^
        $ (".ember-view.jstree").jstree ("close_all");
        $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
        $ (".ember-view.jstree").jstree ("_open_to", "#j1_" + tempStore);
        later ( ( () => {
          $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_" + tempStore));
          tempStore = "";
        }), 400);
      } else {
        //alert ('83 tempStore false');
        this.set ("albumText", "");
        this.set ("albumName", "");
      }
    }
  }).drop (),

  // CONTEXT MENU Context menu
  /////////////////////////////////////////////////////////////////////////////////////////
  contextItems: [
    { label: "×", disabled: false, action () {} }, // Spacer
    /*{ label: 'Frågor? Kontakta oss...',
      disabled: false,
      action () {
      document.getElementById('do_mail').click();
    }
    },*/
    { label: 'Information',
      disabled: false,
      action () {
        showFileInfo ();
      }
    },
    { label: 'Redigera text...',
      disabled: () => {
        return !(allow.textEdit || allow.adminAll);
      },
      //disabled: false, // For 'anyone text preview' change to this 'disabled:' line!
      // NOTE: Also search for TEXTPREVIEW for another change needed!
      action: () => {
        // Mimic click on the text of the mini-picture (thumbnail)
        $ ("#i" + escapeDots ($ ("#picName").text ().trim ()) + " a").next ().next ().next ().click ();
      }
    },
    { label: 'Redigera bild...', // i18n
      disabled: () => {
        return !(allow.imgEdit || allow.adminAll);
      },
      // to be completed ...
      action () {
        var title = "Information";
        var text = "<br>”Redigera bild...” är en planerad framtida länk<br>till något bildredigeringsprogram"; // i18n
        var yes = "Ok" // i18n
        infoDia (null, null, title, text, yes, true);
        return;
      }
    },
    { label: 'Göm eller visa', // Toggle hide/show
      disabled: () => {
        return !(allow.imgHidden || allow.adminAll);
    },
    action () {
      var picName, act, nels, nelstxt, picNames = [], nodelem = [], nodelem0, i;
      later ( ( () => { // Picname needs time to settle...
        picName = $ ("#picName").text ().trim ();
      }), 50);
      picName = $ ("#picName").text ().trim ();
      picNames [0] = picName;
      nodelem0 = document.getElementById ("i" + picName).firstElementChild.nextElementSibling;
      nels = 1;
      var picMarked = nodelem0.className === "markTrue";
      if (picMarked) {
        picNames = [];
        nodelem = document.getElementsByClassName ("markTrue");
        nels = nodelem.length;
        nelstxt = "alla " + nels;
        if (nels === 2) {nelstxt = "båda två";}
        for (i=0; i<nodelem.length; i++) {
          picNames.push (nodelem [i].nextElementSibling.innerHTML.trim ());
        }
      }
      //console.log (nodelem0.parentNode.style.backgroundColor); // Check representation!
      if (nodelem0.parentNode.style.backgroundColor === $ ("#hideColor").text ())
        {act = 0;} else {act = 1;} // 0 = show, 1 = hide (it's the hide flag!)
      var actxt1 = ["Vill du visa ", "Vill du gömma "];
      var actxt2 = ["ska visas ", "ska gömmas "];
      if (nels > 1) {
        resetBorders (); // Reset all borders
        markBorders (picName); // Mark this one
        $ ("#dialog").html ("<b>" + actxt1 [act] + nelstxt + "?</b><br>" + cosp (picNames) + "<br>" + actxt2 [act]); // Set dialog text content
        $ ("#dialog").dialog ( { // Initiate dialog
          title: "Göm eller visa...",
          autoOpen: false,
          draggable: true,
          modal: true,
          closeOnEscape: true
        });
        // Define button array
        $ ("#dialog").dialog ('option', 'buttons', [
        {
          text: "Ja", // Yes
          "id": "allButt", // Process all
          click: function () {
            hideFunc (picNames, nels, act);
            $ (this).dialog ('close');
          }
        },
        {
          text: "", // Set later, in order to include html tags (illegal here)
          "id": "singButt", // Process only one
          click: function () {
            var nodelem = [];       // Redefined since:
            nodelem [0] = nodelem0; // Else illegal, displays "read-only"!
            picNames [0] = picName;
            nels = 1;
            hideFunc (picNames, nels, act);
            $ (this).dialog ('close');
          }
        }]);
        $ ("#singButt").html ('Nej, bara <span  style="color:deeppink">' + picName + '</span>'); // 'text:', here we may include html tags
        niceDialogOpen ();
        $ ("#allButt").focus ();
      } else {
        hideFunc (picNames, nels, act);
      }
    }
  },
  { label: "───────────────", disabled: false, action () {} }, // Spacer
  { label: 'Markera/avmarkera alla',
    disabled: false,
    action () {
      var picName = $ ("#picName").text ().trim ();
      var tmp = document.getElementById ("i" + picName).firstElementChild.nextElementSibling.className;
      var marked;
      $ ("[alt='MARKER']").removeClass ();
      $ ("#markShow").removeClass ();
      if (tmp === "markTrue") {
        $ ("[alt='MARKER']").addClass ("markFalse");
        $ ("#markShow").addClass ("markFalseShow");
        marked = "0";
      } else {
        $ ("[alt='MARKER']").addClass ("markTrue");
        $ ("#markShow").addClass ("markTrueShow");
        marked = $ ("[alt='MARKER']").length;
      }
      $ (".numMarked").text (marked);
      resetBorders (); // Reset all borders
    }
  },
  { label: 'Markera bara dolda',
    disabled: () => {
      return false;
    },
    action () {
      let hico = $("#hideColor").text ();
      let tmp = document.getElementsByClassName ("img_mini");
      for (let i=0; i<tmp.length; i++) {
        tmp [i].querySelector ("div[alt='MARKER']").setAttribute ("class", "markFalse") ;
        if (tmp [i].style.backgroundColor === hico) {
          tmp [i].querySelector ("div[alt='MARKER']").setAttribute ("class", "markTrue") ;
        }
      }
      $ ('.showCount .numMarked').text ($ (".markTrue").length + " ");
    }
  },
  { label: 'Invertera markeringar',
    disabled: false,
    action () {
      $ (".markTrue").addClass ("set_false");
      $ (".markFalse").addClass ("set_true");
      $ (".set_false").removeClass ("markTrue");
      $ (".set_true").removeClass ("markFalse");
      $ (".set_false").addClass ("markFalse");
      $ (".set_true").addClass ("markTrue");
      $ (".markTrue").removeClass ("set_true");
      $ (".markFalse").removeClass ("set_false");
      var marked = $ (".markTrue").length;
      $ (".numMarked").text (" " + marked);
      var cn = document.getElementById ("markShow").className;
      $ ("#markShow").removeClass ();
      if (cn === "markFalseShow") {
        $ ("#markShow").addClass ("markTrueShow");
      } else {
        $ ("#markShow").addClass ("markFalseShow");
      }
      resetBorders (); // Reset all borders
    }
  },
  { label: 'Placera först',
    disabled: () => {
      return !( (allow.imgReorder && allow.saveChanges) || allow.adminAll);
    },
    action () {
      var picName;
      picName = $ ("#picName").text ();
      var sortOrder = $ ("#sortOrder").text ();
      var rex = new RegExp (picName + ",[\\d,]+\\n?", "");
      var k = sortOrder.search (rex);
      if (k < 1) return;
      var line = sortOrder.match (rex) [0];
      sortOrder = sortOrder.replace (line, "");
      sortOrder = sortOrder.replace (/\\n\\n/g, "\n");
      sortOrder = line.trim () + "\n" + sortOrder.trim ();
      $ ("#sortOrder").text (sortOrder);
      saveOrderFunc (sortOrder) // Save on server disk
      .then ($ ("#refresh-1").click ()); // Call via DOM...
      later ( ( () => {
        scrollTo (null, $ (".showCount:first").offset ().top);
      }), 50);
    }
  },
  { label: 'Placera sist',
    disabled: () => {
      return !( (allow.imgReorder && allow.saveChanges) || allow.adminAll);
      //return !( (allow.imgReorder && allow.saveChanges && $ ("#saveOrder").css ("display") !== "none") || allow.adminAll);
    },
    action () {
      var picName;
      picName = $ ("#picName").text ();
      var sortOrder = $ ("#sortOrder").text ();
      var rex = new RegExp (picName + ",[\\d,]+\\n?", "");
      var k = sortOrder.search (rex);
      if (k < 0) return;
      var line = sortOrder.match (rex) [0];
      sortOrder = sortOrder.replace (line, "");
      sortOrder = sortOrder.replace (/\\n\\n/g, "\n");
      sortOrder = sortOrder.trim () + "\n" + line.trim ();
      $ ("#sortOrder").text (sortOrder);
      saveOrderFunc (sortOrder) // Save on server disk
      .then ($ ("#refresh-1").click ()); // Call via DOM...
      later ( ( () => {
        scrollTo (null, $ ("#lowDown").offset ().top - window.screen.height*0.85);
      }), 50);
    }
  },
  { label:  "───────────────", disabled: false, action () {} }, // Spacer
  { label: 'Ladda ned...',
    disabled: () => {
      return !(["admin", "editall", "edit"].indexOf (loginStatus) > -1 && (allow.imgOriginal || allow.adminAll));
    },
    action () {
      $ ("#downLoad").click (); // Call via DOM since "this" is ...where?
    }
  },
  //{ label: ' ', disabled: false, action () {} }, // Spacer
  { label: 'Länka till...', // i18n
    disabled: () => {
      return !(allow.delcreLink || allow.adminAll);
    },
    action () {
      var picName, nels, nlns, nelstxt, linktxt, picNames = [], nodelem = [], nodelem0, i;
      let symlinkClicked;
      picName = $ ("#picName").text ().trim ();
      later ( ( () => { // Picname needs time to settle...
        picName = $ ("#picName").text ().trim ();
      }), 50);
      resetBorders (); // Reset all borders
      if (!$ ("#i" + escapeDots (picName)).hasClass ("symlink")) { // Leave out symlinks
        markBorders (picName);
        picNames [0] = picName;
        nels = 1;
        symlinkClicked = false;
      } else {
        symlinkClicked = true;
        nels = 0;
        $ ("#picName").text (""); // Signals non-linkable, see "downHere"
      }
      nodelem0 = document.getElementById ("i" + picName).firstElementChild.nextElementSibling;
      var picMarked = nodelem0.className === "markTrue";
      if (picMarked) {
        picNames = [];
        nodelem = document.getElementsByClassName ("markTrue");
        for (i=0; i<nodelem.length; i++) {
          var tmpName = nodelem [i].nextElementSibling.innerHTML.trim ();
          if (!$ ("#i" + escapeDots (tmpName)).hasClass ("symlink")) { // Leave out symlinks
            picNames.push (tmpName);
          }
        }
        nels = picNames.length;
        nlns = nodelem.length - nels;
        linktxt = "";
        if (nlns > 0) {linktxt = "En är redan länk, övriga:<br>";} // i18n
        if (nlns > 1) {linktxt = nlns + " är länkar och kan inte användas; övriga:<br>";} // i18n
        nelstxt = "Vill du länka alla " + nels; // i18n
        if (nels === 2) {nelstxt = "Vill du länka båda två";} // i18n
      }
      if (nels === 0) {
        var title = "Ingenting att länka"; // i18n
        var text = "<br><b>Omöjligt att länka länkar!</b>"; // i18n
        var yes = "Uppfattat" // i18n
        infoDia (null, null, title, text, yes, true);
        return;
      }
      //console.log (nodelem0.parentNode.style.backgroundColor); // <- Checks this text content
      $ ("#picNames").text (picNames.join ("\n"));
      if (nels > 1) {
        var lnTxt = "<br>ska länkas till visning också i annat album"; // i18n
        $ ("#dialog").html (linktxt + "<b>" + nelstxt + "?</b><br>" + cosp (picNames) + lnTxt); // Set dialog text content
        $ ("#dialog").dialog ( { // Initiate dialog
          title: "Länka till... ", // i18n
          autoOpen: false,
          draggable: true,
          modal: true,
          closeOnEscape: true
        });
        // Define button array
        $ ("#dialog").dialog ('option', 'buttons', [
        {
          text: "Ja", // Yes i18n
          "id": "allButt", // Process all
          click: function () {
            $ (this).dialog ('close');
            linkFunc (picNames);
            spinnerWait (false);
          }
        },
        {
          text: "", // Set later, in order to include html tags (illegal here)
          "id": "singButt", // Process only one
          click: function () {
            if (picName === "") {
              $ (this).dialog ('close');
            } else {
              var nodelem = [];       // Redefined since:
              nodelem [0] = nodelem0; // Else illegal, displays "read-only"!
              picNames = [];
              picNames [0] = picName;
              nels = 1;
              $ ("#picNames").text (picNames.join ("\n"));
              $ (this).dialog ('close');
              linkFunc (picNames);
              spinnerWait (false);
            }
          }
        }]);
        if (symlinkClicked) {
          picName = "";
          $ ("#singButt").html ("Nej");
        } else {
          $ ("#singButt").html ('Nej, bara <span  style="color:deeppink">' + picName + '</span>'); // 'text:', here we may include html tags
        }
        niceDialogOpen ();
        $ ("#singButt").removeClass ("ui-button-disabled ui-state-disabled");
        if ($ ("#picName").text () === "") { // "downHere", referenced above
          $ ("#singButt").addClass ("ui-button-disabled ui-state-disabled");
        }
        $ ("#allButt").focus ();
      } else {
        $ (this).dialog ('close');
        markBorders (picNames [0]); // Mark this single one, even if it wasn't clicked
        linkFunc (picNames);
        niceDialogOpen ();
        spinnerWait (false);
      }
    }
  },
  { label: 'Flytta till...', // i18n
    disabled: () => {
      return !(allow.delcreLink || allow.adminAll);
    },
    action () {
      var picName, nels, nlns, nelstxt, movetxt, picNames = [], nodelem = [], nodelem0, i;
      let symlinkClicked;
      picName = $ ("#picName").text ().trim ();
      later ( ( () => { // Picname needs time to settle...
        picName = $ ("#picName").text ().trim ();
      }), 50);
      resetBorders (); // Reset all borders
      //if (!$ ("#i" + escapeDots (picName)).hasClass ("symlink")) { // Leave out symlinks
        markBorders (picName);
        picNames [0] = picName;
        nels = 1;
        symlinkClicked = false;
      /*} else {
        symlinkClicked = true; // Saved old code here:
        // NOTE: symlinkClicked isn't utilized any longer since symlinks may be moved
        nels = 0;
        $ ("#picName").text (""); // Signals non-movable, see "downHere"
      }*/
      nodelem0 = document.getElementById ("i" + picName).firstElementChild.nextElementSibling;
      var picMarked = nodelem0.className === "markTrue";
      if (picMarked) {
        picNames = [];
        nodelem = document.getElementsByClassName ("markTrue");
        for (i=0; i<nodelem.length; i++) {
          var tmpName = nodelem [i].nextElementSibling.innerHTML.trim ();
          //if (!$ ("#i" + escapeDots (tmpName)).hasClass ("symlink")) { // Leave out symlinks
            picNames.push (tmpName);
          //}
        }
        nels = picNames.length;
        nlns = nodelem.length - nels;
        movetxt = "";
        if (nlns > 0) {movetxt = "En är länk och kan inte flyttas; övriga:<br>";} // i18n
        if (nlns > 1) {movetxt = nlns + " är länkar som inte kan flyttas; övriga:<br>";} // i18n
        nelstxt = "Vill du flytta alla " + nels; // i18n
        if (nels === 2) {nelstxt = "Vill du flytta båda två";} // i18n
      }
      if (nels === 0) {
        var title = "Ingenting att flytta"; // i18n
        var text = "<br><b>Omöjligt att flytta länkar!</b>"; // i18n
        var yes = "Uppfattat" // i18n
        infoDia (null, null, title, text, yes, true);
        return;
      }
      //console.log (nodelem0.parentNode.style.backgroundColor); // <- Checks this text content
      $ ("#picNames").text (picNames.join ("\n"));
      if (nels > 1) {
        var mvTxt = "<br>ska flyttas till annat album"; // i18n
        $ ("#dialog").html (movetxt + "<b>" + nelstxt + "?</b><br>" + cosp (picNames) + mvTxt); // Set dialog text content
        $ ("#dialog").dialog ( { // Initiate dialog
          title: "Flytta till... ", // i18n
          autoOpen: false,
          draggable: true,
          modal: true,
          closeOnEscape: true
        });
        // Define button array
        $ ("#dialog").dialog ('option', 'buttons', [
        {
          text: "Ja", // Yes i18n
          "id": "allButt", // Process all
          click: function () {
            $ (this).dialog ('close');
            moveFunc (picNames);
          }
        },
        {
          text: "", // Set later, in order to include html tags (illegal here)
          "id": "singButt", // Process only one
          click: function () {
            if (picName === "") {
              $ (this).dialog ('close');
            } else {
              var nodelem = [];       // Redefined since:
              nodelem [0] = nodelem0; // Else illegal, displays "read-only"!
              picNames = [];
              picNames [0] = picName;
              nels = 1;
              $ ("#picNames").text (picNames.join ("\n"));
              $ (this).dialog ('close');
              moveFunc (picNames);
            }
          }
        }]);
        if (symlinkClicked) {
          picName = "";
          $ ("#singButt").html ("Nej");
        } else {
          $ ("#singButt").html ('Nej, bara <span  style="color:deeppink">' + picName + '</span>'); // 'text:', here we may include html tags
        }
        niceDialogOpen ();
        $ ("#singButt").removeClass ("ui-button-disabled ui-state-disabled");
        if ($ ("#picName").text () === "") { // "downHere", referenced above
          $ ("#singButt").addClass ("ui-button-disabled ui-state-disabled");
        }
        $ ("#allButt").focus ();
      } else {
        $ (this).dialog ('close');
        markBorders (picNames [0]); // Mark this single one, even if it wasn't clicked
        moveFunc (picNames);
        niceDialogOpen ();
      }
    }
  },
  { label: 'RADERA...',
    disabled: () => {
      return !(allow.delcreLink || allow.deleteImg || allow.adminAll);
    },
    action () {
      // Decide whether also the ORIGINAL will be erased when a LINKED PICTURE is erased
      if (allow.deleteImg && $ ("#eraOrig") [0].checked === true) {
        eraseOriginals = true;
      } else {
        eraseOriginals = false;
      }
      var picPath, picName, delNames, all, nels, nelstxt,
        picPaths = [], picNames = [], nodelem = [], nodelem0, linked;
      picName = $ ("#picName").text ().trim ();
      picPath = $ ("#imdbLink").text () + "/" + $ ("#i" + escapeDots (picName) + " a img").attr ("title");
      // Non-symlink clicked:
      var title = "Otillåtet"; // i18n
      var text = "<br>— du får bara radera länkar —"; // i18n
      var yes = "Uppfattat" // i18n
      let symlink = document.getElementById ("i" + picName).classList.contains ('symlink');
      if (!symlink && !allow.deleteImg) {
        infoDia (null, null, title, text, yes, true);
        return;
      }
      // nels == no of all elements (images), linked == no of linked elements
      nodelem0 = document.getElementById ("i" + picName).firstElementChild.nextElementSibling;
      nodelem [0] = nodelem0;
      nels = 1;
      var picMarked = nodelem0.className === "markTrue";
      if (picMarked) {
        picNames = [];
        picPaths = [];
        nodelem = document.getElementsByClassName ("markTrue");
        linked = $ (".symlink .markTrue").length;
        all = "alla ";
        nels = nodelem.length;
        nelstxt = nels; // To be used as text...
        if (nels === 2) {all = "båda "; nelstxt = "två";}
      }
      for (let i=0; i<nels; i++) {
        picNames.push (nodelem [i].nextElementSibling.innerHTML.trim ());
      }
      for (let i=0; i<nodelem.length; i++) {
          symlink = document.getElementById ("i" + picNames [i]).classList.contains ('symlink');
          if (symlink && eraseOriginals) {
            /* Use file paths instead of picture names in order to make
            possible erase even symlinked originals (e.g. for dups removal):
            deleteFiles (picNames, nels) was changed to
            deleteFiles (picNames, nels, picPaths) and
            deleteFile (picName) was changed to deleteFile (picPath)
            */
            let tmp = $ ("#imdbLink").text () + "/" + $ ("#i" + escapeDots (picNames [i]) + " a img").attr ("title");
            execute ("readlink -n " + tmp).then (res => {
              res = res.replace (/^(\.{1,2}\/)*/, $ ("#imdbLink").text () + "/");
              picPaths.push (res);
              if (picName === picNames [i]) {
                picPath = res;
              }
            });
          } else {
            picPaths.push ($ ("#imdbLink").text () + "/" + $ ("#i" + escapeDots (picNames [i]) + " a img").attr ("title"));
          }
      }
      delNames = picName;
      if (nels > 1) {

        // Not only symlinks are included:
        if (nels > linked && !allow.deleteImg) {
          infoDia (null, null, title, text, yes, true);
          return;
        }

        delNames =  cosp (picNames);
        nelstxt = "<b>Vill du radera " + all + nelstxt + "?</b><br>" + delNames + "<br>ska raderas permanent";
        if (linked) {
          if (eraseOriginals) {
            nelstxt += " *<br><span style='color:black;font-weight:bold'>* <span style='color:#d00'>Originalet</span> till <span style='color:green'>länk</span> raderas nu också!</span>"; // #d00 is deep red
          } else {
            nelstxt += " *<br><span style='color:green;font-size:85%'>* Då <span style='color:green;text-decoration:underline'>länk</span> raderas berörs inte originalet</span>";
          }
        }
        $ ("#dialog").html (nelstxt); // i18n
        var eraseText = $ ("#imdbDir").text ().replace (/^(.+[/])+/, "") + ": Radera...";
        // Set dialog text content
        $ ("#dialog").dialog ( { // Initiate dialog
          title: eraseText,
          autoOpen: false,
          draggable: true,
          modal: true,
          closeOnEscape: true
        });
        // Close button
        $ ("#dialog").dialog ('option', 'buttons', [ // Define button array
        {
          text: "Ja", // Yes
          "id": "allButt", // Process all
          click: function () {
            $ (this).dialog ('close');
            nextStep (nels);
          }
        },
        {
          text: "", // Set later, (html tags are killed here)
          "id": "singButt", // Process only one
          click: function () {
            var nodelem = [];       // Redefined since:
            nodelem [0] = nodelem0; // Else illegal, displays "read-only"!
            picPaths [0] = picPath;
            picNames [0] = picName;
            delNames = picName;
            nels = 1;
            $ (this).dialog ('close');
            nextStep (nels);
          }
        }]);
        resetBorders (); // Reset all borders
        markBorders (picName); // Mark this one
        $ ("#singButt").html ('Nej, bara <span  style="color:deeppink">' + picName + '</span>'); // May contain html
        niceDialogOpen ();
        $ ("#allButt").focus ();
      } else {
        nextStep (nels);
      }

      function nextStep (nels) {
        /*for (let i=0; i<nels; i++) {
        console.log ("DELETE", picNames [i], picPaths [i]);
        }*/
        var nameText = $ ("#imdbDir").text ().replace (/^(.+[/])+/, "");
        if (nameText === $ ("#imdbLink").text ()) {nameText = $ ("#imdbRoot").text ();}
        var eraseText = "Radera i " + nameText + ":";
        resetBorders (); // Reset all borders, can be first step!
        markBorders (picName); // Mark this one
        if (nels === 1) {
          linked = $ ("#i" + escapeDots (picName)).hasClass ("symlink");
        }
        nelstxt = "<b>Vänligen bekräfta:</b><br>" + delNames + "<br>i <b>" + nameText + "<br>ska alltså raderas?</b><br>(<i>kan inte ångras</i>)"; // i18n
        if (linked) {
          if (eraseOriginals) {
            nelstxt += " *<br><span style='color:black;font-weight:bold'>* <span style='color:#d00'>Originalet</span> till <span style='color:green'>länk</span> raderas nu också!</span>"; // #d00 is deep red
          } else {
            nelstxt += "<br><span style='color:green;font-size:85%'>Då <span style='color:green;text-decoration:underline'>länk</span> raderas berörs inte originalet</span>"; // i18n
          }
        }
        $ ("#dialog").html (nelstxt);
        $ ("#dialog").dialog ( { // Initiate a new, confirmation dialog
          title: eraseText,
          closeText: "×",
          autoOpen: false,
          draggable: true,
          modal: true,
          closeOnEscape: true
        });
        $ ("#dialog").dialog ('option', 'buttons', [ // Define button array
        {
          text: "Ja", // Yes
          "id": "yesBut",
          click: function () {
            /*if (!(allow.deleteImg || allow.adminAll)) { // Will never happen
              userLog ("RADERING FÖRHINDRAD"); // i18n
              return;
            }*/
            console.log ("To be deleted: " + delNames); // delNames is picNames as a string
            // NOTE: Must be a 'clean' call (no then or <await>):
            deleteFiles (picNames, nels, picPaths);
            $ (this).dialog ('close');
            later ( ( () => {
              document.getElementById("reLd").disabled = false;
              $ ("#reLd").click ();
              //userLog ($ ("#temporary").text ()); // From deleteFiles
              //$ ("#temporary").text ("");
            }), 750);
            scrollTo (null, $ ("#highUp").offset ().top);
            $ ("#refresh-1").click ();
          }
        },
        {
          text: "Nej", // No
          "id": "noBut",
          click: function () {
            console.log ("Untouched: " + delNames);
            $ (this).dialog ('close');
          }
         }]);
        niceDialogOpen ();
        $ ("#yesBut").focus ();
      }
    }
  },
  { label: "×", disabled: false, action () {} }, // Spacer
  ],
  //contextSelection: [{ paramDum: false }],  // The context menu "selection" parameter (not used)
  contextSelection: () => {return {}},
  _contextMenu (e) {
    later ( ( () => {
      // At text edit (ediText) || running slide show
      if ( ($ ("div[aria-describedby='textareas']").css ("display") !== "none") || ($ ("#navAuto").text () === "true") ) {
        $ ("ul.context-menu").hide ();
        return;
      }
      $ ("#dialog").dialog ("close"); // Since a modal initiated with open non-modal => danger!
      $ ("ul.context-menu").hide ();
      var nodelem = e.target;
      if (nodelem.tagName === 'IMG' && nodelem.className.indexOf ('left-click') > -1 || nodelem.parentElement.id === 'link_show') {
        // Set the target image path. If the show-image is clicked the target is likely an
        // invisible navigation link, thus reset to parent.firstchild (= no-op for mini-images):
        let tmp = nodelem.parentElement.firstElementChild.title.trim ()
        $ ("#picOrig").text ($ ("#imdbLink").text () +"/"+ tmp);
        // Set the target image name, which is in the second parent sibling in both cases:
        var namepic = nodelem.parentElement.nextElementSibling.nextElementSibling.innerHTML.trim ();
        $ ("#picName").text (namepic);

        // Ascertain that the minipic is shown (maybe autocreated just now?)
        var toshow = document.getElementById ("i" + namepic).firstElementChild.firstElementChild;
        var minipic = toshow.getAttribute ("src");
        toshow.removeAttribute ("src");
        toshow.setAttribute ("src", minipic);
        //var docLen = document.body.scrollHeight; // <- NOTE: this is the document Ypx height
        //var docWid = document.body.scrollWidth; // <- NOTE: this is the document Xpx width
        // var scrollY = window.pageYOffset; // <- NOTE: the Ypx document coord of the viewport

        $ ("#wormhole-context-menu").css ("position", "absolute"); // Change from fixed

        $ ("div.context-menu-container").css ("position", "relative"); // Change from fixed
        var viewTop = window.pageYOffset; // The viewport position
        var tmpTop = e.clientY;           // The mouse position
        $ ("div.context-menu-container").css ("top", (viewTop + tmpTop) + "px");

        $ ("ul.context-menu").css ("left", "-2px");
        $ ("ul.context-menu").css ("right", "");
        $ ("ul.context-menu.context-menu--left").css ("left", "");
        $ ("ul.context-menu.context-menu--left").css ("right", "2px");
        $ ("ul.context-menu").show ();

      }
    }), 7); /* was 7 */
  },

  // STORAGE FOR THE HTML page population, and other storages
  /////////////////////////////////////////////////////////////////////////////////////////
  // allNames: File names etc. (object array) for the thumbnail list generation
  allNames: () => {return []},
  timer: null,  // The timer for auto slide show
  savekey: -1,  // The last pressed keycode used to lock Ctrl+A etc.
  userDir:  "undefined", // Current server user directory
  imdbLink: "", // Name of the symbolic link to the imdb root directory (from server)
  imdbRoot: "", // The imdb directory (initial default = env.variable $IMDB_ROOT)
  imdbRoots: () => {return []}, // For imdbRoot selection
  //imdbDir: "",  // Current picture directory, selected from imdbDirs
  imdbDirs: () => {return ['Albums?']}, // Reset in requestDirs
  imdbPics: () => {return ['Alpics?']}, // Reset in requestDirs
  jstreeHdr: "",
  albumName: "",
  albumText: "",
  albumData: () => {return []}, // Directory structure for the selected imdbRoot
  loggedIn: false,
  subaList: [],
  // HOOKS, that is, Ember "hooks" in the execution cycle
  /////////////////////////////////////////////////////////////////////////////////////////
  //----------------------------------------------------------------------------------------------
  init () { // ##### Component initiation
    this._super (...arguments);
    $ (document).ready ( () => {
      spinnerWait (true); //== testing

      // Here is the base IMDB_LINK setting, used for imdbLink in ld_imdb.js:
      $ ("#imdbLink").text ("imdb"); // <<<<<<<<<< == IMDB_LINK in routes.js

      $ ("#menuButton").attr ("title", htmlSafe ("Öppna\nmenyn")); // i18n
      // Remember update *.hbs
      $ ("#bkgrColor").text ("rgb(59, 59, 59)"); // #333
      // Set the hidden-picture text background color:
      $ ("#hideColor").text ("rgb(0, 50, 100)");
      // Set body class BACKG:
      $ ("body").addClass ("BACKG TEXTC");
      $ ("body").css ("background", BACKG);
      $ ("body").css ("color", TEXTC);
      $ ("#viSt").hide ();
      later ( ( () => {
        if (!getCookie("bgtheme")) {
          setCookie("bgtheme", "light", 0);
        } else {
          this.actions.toggleBackg (); this.actions.toggleBackg ();
        }
        console.log ("jQuery v" + $ ().jquery);
        // The time stamp is produced with the Bash 'ember-b-script'
        // userLog ($ ("#timeStamp").text (), true); // Confuses phone users
        // Login advice:
        $ ("#title a.proid").attr ("title", homeTip);
        //$ ("#title a.proid").attr ("totip", homeTip);
        $ ("#title a.toggbkg").attr ("title", bkgTip);
        $ ("#title button.cred").attr ("title", logAdv);
        $ ("#title button.cred").attr ("totip", logAdv);
        // Initialize settings:
        // This #picFound search result album will, harmlessly, have identical
        // name within a session for any #imdbRoot (if you switch between them)
        let rnd = "." + Math.random().toString(36).substr(2,4);
        $ ("#picFound").text (picFound + rnd); // i18n
        console.log ("picFound:", $ ("#picFound").text ());
        zeroSet ();
        this.actions.setAllow ();
        this.actions.setAllow (true);
        later ( (async () => {
          prepDialog ();
          prepTextEditDialog ();
          prepSearchDialog ();

// Also in requestDirs?:
          let rootList = await reqRoot (); //  Get possible rootdirs
//console.log("rootList",rootList);
          if (rootList) {
            rootList = rootList.split ("\n");
//console.log("#imdbRoot", $ ("#imdbRoot").text ());
            let seltxt = rootList [0];
            rootList.splice (0, 1, "");
            rootList [0] = "Välj albumkatalog "; // i18n, must have a space
            let selix = rootList.indexOf (seltxt);
//console.log("seltxt",seltxt,"| selix",selix);
//console.log("rootList",rootList);
            if (selix > 0) {
              this.set ("imdbRoot", seltxt);
              $ ("#imdbRoot").text (seltxt);
              //let imdbRoot = seltxt;
            }
            this.set ("imdbRoots", rootList);
            rootList = rootList.join ("\n");
            $ ("#imdbRoots").text (rootList);
          }

        }), 25);
        later ( ( () => { // To top of screen:
          scrollTo (0, 0);
          $ ("#title a.proid").focus ();
          later ( ( () => { // Default user:
            $ (".cred.user").attr ("value", "gäst"); // i18n
            $ (".cred.login").click ();
            later ( ( () => {
              $ (".cred.login").click (); // Confirm logIn
              $ (".cred.user").click (); // Prevents FF showing link to saved passwords
              $ ("#title a.proid").focus ();
              //this.actions.selectRoot ("");
            }), 1000);
          }), 1000);
        }), 200);
      }), 200);
    });
//console.log(document.cookie);
    // Trigger the jQuery tooltip on 'totip="..."' (custom attribute)
    $ (function () {
      $ (document).tooltip ({
        items: "[totip]",
        content: function () {
          var elem = $ (this);
          if (elem.is ("[totip]")) {
            return elem.attr ("totip");
          }
        },
        show: {
          //effect: "slideDown",
          effect: "blind",
          //duration: 0, do not use
          delay: 0
          //effect: "fade"
        },
        position: {
          my: "left top+2",
          at: "left bottom"
        },
        close: function () {
          // Clean upp tooltip garbage and hide new tooltip text down below:
          $ ("div.ui-helper-hidden-accessible").html ("");
          $ ("div.ui-helper-hidden-accessible").attr ("style", "position:fixed;top:8192px");
        }
      });
      $ (document).tooltip ("disable");
    });
  },
  //----------------------------------------------------------------------------------------------
  didInsertElement () { // ##### Runs at page ready state
    this._super (...arguments);

    this.setNavKeys ();
    // Search locates also hidden images, thus must be allowed:
    if (allow.imgHidden || allow.adminAll) {
      $ ("button.findText").show ()
    } else {
      $ ("button.findText").hide ()
    }
    execute ("head -n1 LICENSE.txt").then (a => {
      $ (".copyright").text (a);
    /*}).then ( () => {
      later ( ( () => {
        if (allow.textEdit || allow.adminAll) $ (".img_txt1, .img_txt2").css ("cursor","pointer");
        else $ (".img_txt1, .img_txt2").css ("cursor","text");
      }), 4000);*/
     });
  },
  //----------------------------------------------------------------------------------------------
  didRender () {
    this._super (...arguments);
    $ (document).ready ( () => {

      devSpec ();
      $ (".BACKG").css ("background", BACKG);
      $ (".TEXTC").css ("color", TEXTC);
      $ (".BLUET").css ("color", BLUET);

      if ($ ("#hideFlag").text () === "1") {
        this.actions.hideFlagged (true).then (null);
      } else {
        this.actions.hideFlagged (false).then (null);
      }

      later ( ( () => {
        // Update the slide show speed factor when it is changed
        document.querySelector ('input.showTime[type="number"]').addEventListener ('change', function () {$ ("#showFactor").text (parseInt (this.value));});

        $ ("span#showSpeed").hide ();
        $ ("div.ember-view.jstree").attr ("onclick", "return false");

        if (allow.imgHidden || allow.adminAll) { // Qualified if at least Guest
          $ (".img_mini.symlink [alt='MARKER']").attr("title", "Klick = markera; med Ctrl eller högerklick = gå till källan");
        }
      }), 10);
    });
  },

  // HELP FUNCTIONS, that is, component methods (within-component functions)
  /////////////////////////////////////////////////////////////////////////////////////////
  //----------------------------------------------------------------------------------------------
  refreshAll () {
    // ===== Updates allNames and the sortOrder tables by locating all images and
    // their metadata in the "imdbDir" dir (name is DOM saved) on the server disk.
    // This will trigger the template to restore the DOM elements. Prepare the didRender hook
    // to further restore all details!
    return new Promise (resolve => {
      var test = 'A1';
      this.requestOrder ().then (sortnames => {
        if (sortnames === undefined) {sortnames = "";}
        if (sortnames === "Error!") {
//==          spinnerWait (false);
          $ (".mainMenu").show ();
          if ($ ("#imdbDir").text () !== "") {
            document.getElementById ("imdbError").className = "show-inline";
          }
          $ ('.showCount').hide ();
          //this.set ("imdbDir", "");
          $ ("#imdbDir").text ("");
          $ ("#sortOrder").text ("");
          $ ('#navKeys').text ('true');
        } else {
          $ ('.showCount:last').hide ();
          $ ("#sortOrder").text (sortnames); // Save in the DOM
        }
        test = 'A2';
        // Use sortOrder (as far as possible) to reorder namedata ERROR
        // First pick out namedata (allNames) against sortnames (SN), then any remaining
        this.requestNames ().then (namedata => {
          var i = 0, k = 0;
          // --- Start prepare sortnames checking CSV columns
          var SN = [];
          if ($ ("#sortOrder").text ().trim ().length > 0) {
            SN = $ ("#sortOrder").text ().trim ().split ('\n');
          }
          //console.log("NOTE: SN is the latest saved list of images, not nesseceraly reflecting the actual directory content (must have been saved to do that):",SN);
          sortnames = '';
          for (i=0; i<SN.length; i++) {
            var tmp = SN [i].split (",");
            if (tmp [0].slice (0, 1) !== ".") {
              if (tmp.length < 2) {
                tmp.push (" ");
                SN [i] = SN [i] + ",";
              }
              if (tmp [1].trim ().length === 0) {SN [i] = SN [i] + '0';}
              if (tmp.length < 3) {
                tmp.push (" ");
                SN [i] = SN [i] + ",";
              }
              if (tmp [2].trim ().length === 0) {SN [i] = SN [i] + '0';}
              sortnames = sortnames +'\n'+ SN [i];
            }
          }
          test = 'A3';
          sortnames = sortnames.trim (); // Important!
          if (sortnames === "") {
            var snamsvec = [];
          } else {
            snamsvec = sortnames.split ('\n'); // sortnames vectorized
          }
          // --- Pull out the plain sort order file names: snams <=> sortnames
          var snams = [];
          // snamsvec is sortnames vectorized
          for (i=0; i<snamsvec.length; i++) {
            // snams is kind of 'sortnames.name'
            snams.push (snamsvec [i].split (",") [0]);
          }
          // --- END prepare sortnames
          // --- Pull out the plain dir list file names: name <=> namedata (undefined order)
          if (namedata === undefined) {namedata = [];}
          var name = [];
          for (i=0; i<namedata.length; i++) {
            name.push (namedata [i].name);
          }
          test ='B';
          // --- Make the object vector 'newdata' for new 'namedata=allNames' content
          // --- Use 'snams' order to pick from 'namedata' into 'newdata' and 'newsort'
          // --- 'namedata' and 'name': Ordered as from disk (like unknown)
          var newsort = "", newdata = [];
          while (snams.length > 0 && name.length > 0) {
            k = name.indexOf (snams [0]);
            if (k > -1) {
              newsort = newsort + snamsvec [0] + "\n";
              newdata.pushObject (namedata [k]);
              namedata.removeAt (k, 1);
              name.splice (k, 1);
            }
            snamsvec.splice (0, 1);
            snams.splice (0, 1);
          }
          test ='C';
          // --- Move remaining 'namedata' objects (e.g. uploads) into 'newdata' until empty.
          // --- Place them first to get better noticed. Update newsort for sortnames.
          // --- The names, of such (added) 'namedata' objects, are kept remaining in 'name'??
          while (namedata.length > 0) {
            newsort = namedata [0].name + ",0,0\n" + newsort;
            //newdata.pushObject (namedata [0]); instead:
            newdata.insertAt (0, namedata [0]);
            namedata.removeAt (0, 1);
          }

          newsort = newsort.trim (); // Important
          test ='E0';
          this.set ("allNames", newdata); // The minipics reload is triggered here (RELOAD)
          $ ('#sortOrder').text (newsort); // Save in the DOM
          //console.log("NOTE: newsort is the true list of images in the actual directory:",newsort.split("\n"));
          //console.log("NOTE: newdata will trigger the thumbnails reload:",this.get ("allNames"));
          preloadShowImg = []; // Preload show images:
          var n = newdata.length;
          let nWarn = 100;
          for (i=0; i<n; i++) {
            preloadShowImg [i] = new Image();
            preloadShowImg [i].src = newdata [i].show;
          }
          if ( (n > nWarn) && (allow.imgUpload || allow.adminAll)) {
            infoDia (null, null, "M Ä N G D V A R N I N G", "<b>Ett album bör av alla möjliga <br>praktiska och tekniska skäl inte ha <br>särskilt många fler än etthundra bilder. <br>Försök att dela på det här albumet ...</b>", "... uppfattat!", true);
          }
          if (n > 0) {
            $ (".numMarked").text (" " + $ (".markTrue").length);
            if ($ ("#hideFlag") === "1") {
              $ (".numHidden").text (" " + $ (".img_mini [backgroundColor=$('#hideColor')]").length);
              // DOES THIS WORK OR MAY IT BE REMOVED??
              $ (".numShown").text (" " + $ (".img_mini [backgroundColor!=$('#hideColor')]").length);
            } else {
              $ (".numHidden").text ("0");
              $ (".numShown").text ($ (".img_mini").length);
            }

            later ( ( () => {
              if (document.querySelector("strong.albumName") && document.querySelector ("strong.albumName") [0] && document.querySelector ("strong.albumName") [0].innerHTML.replace (/&nbsp;/g, " ").trim () === $ ("#picFound").text ().replace (/\.[^.]{4}$/, "").replace (/_/g, " ")) {
                // The search result album
                $ ("div.BUT_2").html ($.parseHTML ('<span style="color:#0b0";font-weight:bold>Gå till bildens eget album med högerklick i grön ring!</span>'));
              } else {
                let ntot = $ (".img_mini").length;
                let nlink = $ (".img_mini.symlink" ).length;
                //console.log(ntot,nlink);
                let ntext = $ ("div.BUT_2").text ().replace (/(^[^,]*),.*$/, "$1");
                let nown = ntot - nlink;
                if (nown === 1) {
                  ntext += ", 1 bild";
                } else {
                  ntext += ", " + nown + " bilder";
                } // i18n
                let ltext = " länkade";
                if (nlink === 1) {ltext = " länkad";}
                if (nlink > 0) {
                  if (nown === 1) {
                    ntext += " (egen) + " + nlink + ltext;
                  } else {
                    ntext += " (egna) + " + nlink + ltext;
                  }
                } // i18n
                $ ("div.BUT_2").text (ntext);
              }
            }), 777);

            userLog ("RELOAD");
          } else {
            later ( ( () => {
              let ntext = $ ("div.BUT_2").text ().replace (/(^[^,]*),.*$/, "$1");
              $ ("div.BUT_2").text (ntext);
              //if ($ ("strong.albumName") [0].innerHTML.replace (/&nbsp;/g, " ") === $ ("#picFound").text ().replace (/_/g, " ")) {
              if (document.querySelector("strong.albumName") && document.querySelector ("strong.albumName") [0] && document.querySelector ("strong.albumName") [0].innerHTML.replace (/&nbsp;/g, " ") === $ ("#picFound").text ().replace (/\.[^.]{4}$/, "").replace (/_/g, " ")) {
                $ ("div.BUT_2").text (""); // The search result album
              }
            }), 777);
          }
          test = 'E1';
          later ( ( () => {
            if ($ ("#hideNames").text () === "1") {
              $ (".img_name").hide ();
            } else {
              $ (".img_name").show ();
            }
          }), 20);
          later ( ( () => {
            $ ("#saveOrder").click ();
          }), 200);
        }).catch (error => {
          console.error (test + ' in function refreshAll: ' + error.message);
        });
      }).catch ( () => {
        console.log ("Not found");
      });
      $ ('#navKeys').text ('true');
      if ($ ("#imdbDir").text () !== "") {
        this.actions.imageList (true);
      }
      resolve ();
    });
  },
  //----------------------------------------------------------------------------------------------
  setNavKeys () { // ===== Trigger actions.showNext when key < or > is pressed etc...

    var triggerClick = (evnt) => {
      var that = this;
      var tgt = evnt.target;
      let tgtClass = "";
      if (tgt) {
        tgtClass = tgt.classList [0] || "";
      }
      if (tgtClass === "context-menu" || tgtClass === "spinner") {
        return;
      }
      if (tgt.id === "wrap_pad") {
        that.actions.hideShow ();
        return;
      }
      if (!tgt.parentElement) return; // impossible
      if (tgt.tagName !=="IMG" && tgt.parentElement.firstElementChild.tagName !== "IMG") return;

      // Ctrl + click may replace right-click on Mac
      if (evnt.ctrlKey) {
        if ($ (tgt).hasClass ("mark")) {
          if (allow.imgHidden || allow.adminAll) {
            // Right click on the marker area of a thumbnail...
            parentAlbum (tgt);
          }
          return;
        }
        $(tgt.parentElement.firstElementChild).trigger('contextmenu');
        // Have to be repeated because of this extra contextmenu trigging. Keeps the menu
        // by the pointer for both rightclick, Ctrl + rightclic, and Ctrl + leftclick:
        var viewTop = window.pageYOffset; // The viewport position
        var tmpTop = evnt.clientY;           // The mouse position
        $ ("div.context-menu-container").css ("top", (viewTop + tmpTop) + "px");
        var viewLeft = window.pageXOffset; // The viewport position
        var tmpLeft = evnt.clientX;           // The mouse position
        $ ("div.context-menu-container").css ("left", (viewLeft + tmpLeft) + "px");
        return;
      }
      if ($ (tgt).hasClass ("mark")) {
        if ( (allow.imgHidden || allow.adminAll) && evnt.button === 2) {
          // Right click on the marker area of a thumbnail...
          parentAlbum (tgt);
        }
        return;
      }
      if (evnt.button === 2) return; // ember-context-menu should take it
      var namepic = tgt.parentElement.parentElement.id.slice (1);

      // Check if the intention is to "mark" (Shift + click):
      if (evnt.shiftKey) {
        later ( ( () => {
          that.actions.toggleMark (namepic);
          return;
        }), 20);
      } else {
        // A mini-picture is classless
        if (tgt.parentElement.className || tgt.parentElement.id === "link_show") return;
//console.log("tgt",tgt);
        var origpic = $ ("#imdbLink").text () + "/" + tgt.title;
        var minipic = tgt.src;
        var showpic = minipic.replace ("/_mini_", "/_show_");
        document.getElementById ("divDropbox").className = "hide-all";
        this.actions.showShow (showpic, namepic, origpic);
        return;
      }
    }
    document.addEventListener ("click", triggerClick, false); // Click (at least left click)
    document.addEventListener ("contextmenu", triggerClick, false); // Right click

    // Then the keyboard, actions.showNext etc.:
    var that = this;
    function triggerKeys (event) {
      var Z = false; // Debugging switch
      if (event.keyCode === 112) { // F1 key
        that.actions.toggleHelp ();
      } else
      if (event.keyCode === 27) { // ESC key
        // If #navAuto is true, runAuto will be stopped if it is running
        // (with no dialogs open). Else, #navAuto SHOULD be false, anyhow!
        $ ("#navAuto").text ("false");
        $ (".mainMenu").hide ();
        $ ("iframe").hide ();
        $ ("div.ui-tooltip-content").remove (); // May remain unintentionally ...
        if ($ ("div.settings").is (":visible")) { // Hide settings
          $ ("div.settings, div.settings div.check").hide ();
          return;
        }
        if (document.getElementById ("divDropbox").className !== "hide-all") { // Hide upload
          document.getElementById ("divDropbox").className = "hide-all";
          return;
        }
        if ($ ("#notes").is (":visible")) {
          $ ("#notes").dialog ("close");
        } else
        if ($ ("#dialog").is (":visible")) {
          $ ("#dialog").dialog ("close");
          $ ('#navKeys').text ('true'); // Reset if L/R arrows have been protected
        } else
        if ($ ("div[aria-describedby='textareas']").css ("display") !== "none") { // At text edit, visible
          ediTextClosed ();
          if (Z) {console.log ('*a');}
        } else // Carefylly here: !== "none" is false if the context menu is absent!
        if ($ ("ul.context-menu").css ("display") === "block") { // When context menu EXISTS and is visible
          $ ("ul.context-menu").hide ();
          if (Z) {console.log ('*b');}
        } else
        if ($ ("#link_show a").css ('opacity') > 0 ) { // The navigation help is visible
          $ ("#link_show a").css ('opacity', 0 );
          if (Z) {console.log ('*c');}
        } else
        if ($ (".toggleAuto").text () === "STOP") { // Auto slide show is running
          later ( ( () => {
            $ (".nav_links .toggleAuto").text ("AUTO");
            $ (".nav_links .toggleAuto").attr ("title", "Avsluta bildbyte [Esc]"); //i18n
            that.runAuto (false);
          }), 100);
          if (Z) {console.log ('*d');}
        } else
          if ($ (".img_show").css ("display") === "block") { // Show image is visible
          that.actions.hideShow ();
          if (Z) {console.log ('*e');}
        } else {
          resetBorders (); // Reset all borders
        }
        if (Z) {console.log ('*f');}
      } else
      if (event.keyCode === 37 && $ ("#navKeys").text () === "true" &&
      $ ("div[aria-describedby='searcharea']").css ("display") === "none" &&
      $ ("div[aria-describedby='textareas']").css ("display") === "none" &&
      !$ ("textarea.favorites").is (":focus") &&
      !$ ("input.cred.user").is (":focus") &&
      !$ ("input.cred.password").is (":focus")) { // Left key <
        event.preventDefault(); // Important!
        that.actions.showNext (false);
        if (Z) {console.log ('*g');}
      } else
      if (event.keyCode === 39 && $ ("#navKeys").text () === "true" &&
      $ ("div[aria-describedby='searcharea']").css ("display") === "none" &&
      $ ("div[aria-describedby='textareas']").css ("display") === "none" &&
      !$ ("textarea.favorites").is (":focus") &&
      !$ ("input.cred.user").is (":focus") &&
      !$ ("input.cred.password").is (":focus")) { // Right key >
        event.preventDefault(); // Important!
        that.actions.showNext (true);
        if (Z) {console.log ('*h');}
      } else
      if (that.savekey !== 17 && event.keyCode === 65 && // A key
      $ ("#navAuto").text () !== "true" &&
      $ ("div[aria-describedby='searcharea']").css ("display") === "none" &&
      $ ("div[aria-describedby='textareas']").css ("display") === "none" &&
      !$ ("input.i_address").is (":visible") && // Contact message mail dialog
      !$ ("textarea.favorites").is (":focus") &&
      !$ ("input.cred.user").is (":focus") &&
      !$ ("input.cred.password").is (":focus")) {
        if (!($ ("#imdbDir").text () === "")) {
          $ ("#dialog").dialog ("close");
          later ( ( () => {
            $ ("#navAuto").text ("false");
            if (Number ($ (".numShown:first").text ()) > 1) {
              $ ("#navAuto").text ("true");
              $ (".nav_links .toggleAuto").text ("STOP");
              $ (".nav_links .toggleAuto").attr ("title", "Avsluta bildbyte [Esc]"); //i18n
              that.runAuto (true);
            }
          }), 250);
          if (Z) {console.log ('*i');}
        }
      } else
      if (that.savekey !== 17 && event.keyCode === 70 && // F key
      $ ("#navAuto").text () !== "true" &&
      $ ("div[aria-describedby='searcharea']").css ("display") === "none" &&
      $ ("div[aria-describedby='textareas']").css ("display") === "none" &&
      !$ ("input.i_address").is (":visible") && // Contact message mail dialog
      !$ ("textarea.favorites").is (":focus") &&
      !$ ("input.cred.user").is (":focus") &&
      !$ ("input.cred.password").is (":focus")) {
        if (!($ ("#imdbDir").text () === "")) {
          //$ ("#dialog").dialog ("close");
          //$ ("#navAuto").text ("true");
          later ( ( () => {
            //$ (".nav_links .toggleAuto").text ("STOP");
            that.actions.findText ();
          }), 250);
          if (Z) {console.log ('*j');}
        }
      } else
      if (that.savekey === 17 && event.keyCode === 83) { // Ctrl + S (for saving texts)
        event.preventDefault(); // Important!
        if ($ ("button.saveNotes").is (":visible")) {
          $ ("button.saveNotes").click ();
        } else
        if ($ ("button.saveTexts").is (":visible") && !$ ("button.saveTexts").attr ("disabled")) {
          $ ("button.saveTexts:first").click ();
        }
        that.savekey = event.keyCode;
      } else {
        that.savekey = event.keyCode;
      }
    }
    document.addEventListener ('keydown', triggerKeys, false);
  },
  //----------------------------------------------------------------------------------------------
  runAuto (yes) { // ===== Help function for toggleAuto
    if (Number ($ (".numShown:first").text ()) < 2) return;
    if (yes) {
      ediTextClosed ();
      $ ("#showSpeed").show ();
      userLog ('BEGIN show');
      //$ ("#showSpeed input").focus (); Fatal for phones!
      var that = this;
      (function sequence () {
        that.actions.showNext (true); // Immediate response
        var showFactor = parseInt ($ ("#showFactor").text ());
        if (showFactor < 1) {showFactor = 0.5;}
        if (showFactor > 99) {showFactor = 99;}
        var txlen = $ ("#wrap_show .img_txt1").text ().length + $ ("#wrap_show .img_txt2").text ().length;
        if (!txlen) {txlen = 0;}
        if (txlen < 100) {txlen = 100;} // 100 char
        if (txlen > 1000) {txlen = 1000;} // 1000 char
        var ms;
        if ($ (".nav_links span a.speedBase").css ('color') === 'rgb(255, 20, 147)') { // deeppink
          ms = 14*txlen;
        } else {
          ms = 1000;
        }
        that.timer = setTimeout (sequence, showFactor*ms);
      } ());
    } else {
      clearTimeout (this.timer);
      $ ("#showSpeed").hide ();
      userLog ('END show');
    }
  },
  //----------------------------------------------------------------------------------------------
  requestOrder () { // ===== Request the sort order list
    return new Promise ( (resolve, reject) => {
      var IMDB_DIR =  $ ('#imdbDir').text ();
      if (IMDB_DIR.slice (-1) !== "/") {IMDB_DIR = IMDB_DIR + "/";}
      IMDB_DIR = IMDB_DIR.replace (/\//g, "@"); // For sub-directories
      var that = this;
      var xhr = new XMLHttpRequest ();
      xhr.open ('GET', 'sortlist/' + IMDB_DIR, true, null, null); // URL matches server-side routes.js
      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          var data = xhr.responseText.trim ();
          if (data.slice (0, 8) === '{"error"') {
            //data = undefined;
            data = "Error!"; // This error text may also be generated elsewhere
          }
          var tmpName = that.get ("albumName");
          tmpName = extractContent (tmpName); // Don't accumulate HTML
          if (tmpName === that.get ("imdbRoot")) {
            document.title = 'Mish: ' + removeUnderscore (that.get ("imdbRoot"), true);
          } else {
            // Do not display the random suffix if this is the search result album
            var tmpIndex = tmpName.indexOf (picFound);
            if (tmpIndex === 0) {
              tmpName = tmpName.replace (/\.[^.]{4}$/, "");
            }
            document.title = 'Mish: ' + removeUnderscore (that.get ("imdbRoot") + " — " + tmpName, true);
          }
          tmpName = removeUnderscore (tmpName); // Improve readability
          that.set ("jstreeHdr", "");
          if (data === "Error!") {
            if (tmpIndex === 0) { // Regenerate the picFound album since it has probably timed out
              let lpath = $ ("#imdbLink").text () + "/" + $ ("#picFound").text ();
              execute ("rm -rf " +lpath+ " && mkdir " +lpath+ " && touch " +lpath+ "/.imdb").then ();
            } else {
              tmpName += " &mdash; <em style=\"color:red;background:transparent\">just nu oåtkomligt</em>" // i18n
              that.set ("albumName", tmpName);
              //that.set ("imdbDir", "");
              $ ("#imdbDir").text
            }
          } else {
            that.set ("albumText", " Albumåtgärder");
            that.set ("albumName", '<strong class="albumName"> ' + tmpName + '</strong>');
            that.set ("jstreeHdr", "Alla album (albumkarta, albumträd):");
            $ ("#jstreeHdr").attr ("title", htmlSafe ("Visa alla album\n(hela albumträdet)")); //i18n
          }
          resolve (data); // Return file-name text lines
          console.log ("ORDER received");
        } else {
          resolve ("Error!");
          reject ({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.onerror = function () {
        resolve ("Error!");
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      };
      xhr.send ();
    }).catch (error => {
      console.error (error.message);
    });
  },
  //----------------------------------------------------------------------------------------------
  requestNames () { // ===== Request the file information list
    // NEPF = number of entries (lines) per file in the plain text-line-result list ('namedata')
    // from the server. The main information is retreived from each image file, e.g.
    // metadata. It is reordered into 'newdata' in 'sortnames' order, as far as possible;
    // 'sortnames' is cleaned from non-existent (removed) files and extended with new (added)
    // files, in order as is. So far, the sort order is 'sortnames' with hideFlag (and albumIndex?)
    var that = this;
    return new Promise ( (resolve, reject) => {
      var IMDB_DIR =  $ ('#imdbDir').text ();
      if (IMDB_DIR.slice (-1) !== "/") {IMDB_DIR = IMDB_DIR + "/";}
      IMDB_DIR = IMDB_DIR.replace (/\//g, "@"); // For sub-directories
      var xhr = new XMLHttpRequest ();
      xhr.open ('GET', 'imagelist/' + IMDB_DIR, true, null, null); // URL matches server-side routes.js
      var allfiles = [];
      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          var Fobj = EmberObject.extend ({
            orig: '',  // for orig-file path (...jpg|tif|png|...)
            show: '',  // for show-file path (_show_...png)
            mini: '',  // for mini-file path (_mini_...png)
            name: '',  // Orig-file base name without extension
            txt1: 'description', // for metadata
            txt2: 'creator',     // for metadata
            symlink: 'false'           // else 'symlink'
          });
          var NEPF = 7; // Number of properties in Fobj
          var result = xhr.responseText;
          result = result.trim ().split ('\n'); // result is vectorised
          var i = 0, j = 0;
          var n_files = result.length/NEPF;
          if (n_files < 1) { // Covers all weird outcomes
            result = [];
            n_files = 0;
            $ ('.showCount .numShown').text (' 0');
            $ ('.showCount .numHidden').text (' 0');
            $ ('.showCount .numMarked').text ('0');
            $ ("span.ifZero").hide ();
            $ ('#navKeys').text ('false'); // Prevents unintended use of L/R arrows
          }
          for (i=0; i<n_files; i++) {
            if (result [j + 4]) {result [j + 4] = result [j + 4].replace (/&lt;br&gt;/g,"<br>");}
            var f = Fobj.create ({
              orig: result [j],
              show: result [j + 1],
              mini: result [j + 2],
              name: result [j + 3],
              txt1: htmlSafe (result [j + 4]),
              txt2: htmlSafe (result [j + 5]),
              symlink: result [j + 6],
            });
            if (f.txt1.toString () === "-") {f.txt1 = "";}
            if (f.txt2.toString () === "-") {f.txt2 = "";}
            j = j + NEPF;
            allfiles.pushObject (f);
          }
          later ( ( () => {
            $ (".showCount:first").show ();
            $ (".miniImgs").show ();
            if (n_files < 1) {
              $ ("#toggleName").hide ();
              $ ("#toggleHide").hide ();
            }
            else {
              $ ("#toggleName").show ();
              if (allow.adminAll || allow.imgHidden) $ ("#toggleHide").show ();
            }
            later ( ( () => {
//==              spinnerWait (false);
              //later ( ( () => {
              that.actions.setAllow (); // Fungerar hyfsat ...?
              //}), 2000);
            }), 2000);
          }), 2000);
          //userLog ('INFO received');
          resolve (allfiles); // Return file-list object array
        } else {
          reject ({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.onerror = function () {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      };
      xhr.send ();
    })
    .then ()
    .catch (error => {
      console.error ("requestNames", error.message);
    });
  },
  //----------------------------------------------------------------------------------------------
  printThis: Ember.inject.service (), // ===== For the 'doPrint' function

  // TEMPLATE ACTIONS, functions reachable from the HTML page
  /////////////////////////////////////////////////////////////////////////////////////////
  actions: {
    //============================================================================================
    doPrint () { // PDF print a show picture and its text (A4 portrait only)
      const selector = "#wrap_pad";
      const options = {
        debug: false,
        importStyle: true,
        loadCSS: "printthis.css",
        printContainer: false,
        pageTitle: "&nbsp;&nbsp;&nbsp;" + $ ("#wrap_pad .img_name").text () + " : " + $ ("#imdbRoot").text () + $ ("#imdbDir").text ().replace (/^[^/]+/, ""),
      };
      this.get("printThis").print(selector, options);
    },
    //============================================================================================
    doMail () { // Send a message 'from a picture'
      if ($ ("input.i_address").is (":visible")) {
        $ ("#dialog").dialog ("close"); // Close if open
        return;
      }
      let user = $ ("#title span.cred.name").text ();
      let picName = $ ("#picName").text ();
      let tmp = extractContent (this.get ("albumName")).replace (/\s/g, "_");
      if (tmp.indexOf (picFound) === 0) picName = picName.replace (/\.[^.]{4}$/, "");
      let title = "Mejl från Mish, <b style='background:inherit'>" + user + "/" + picName + "</b>"; // i18n
      let text = 'Skriv ditt meddelande till Sävar Hembygdsförening:';
      text += '<br><input type="text" class="i_address" title="" placeholder=" Namn och adress (frivilligt)" value="' + '' + '" style="width:100%;background:#f0f0cf;margin: 0.5em 0 0 0">';
      text += '<br><input type="email" class="i_email" title="" placeholder=" Din epostadress (obligatoriskt, visas ej)" value="' + '' + '" style="width:100%;background:#f0f0b0;margin: 0.5em 0 0 0">';
      text += '<br><textarea class="t_mess" rows="6"  title="" placeholder=" Meddelandetext om minst sju tecken (obligatoriskt)" value="' + '' + '" style="width:100%;background:#f0f0b0;color:blue;margin: 0.5em 0 0.5em 0"></textarea><br>Skriv också om du saknar något eller hittar fel i en bildtext – tack! Och berätta om du vill bidra med egna bilder. Det du skriver här kan bara ses av Hembygdsföreningens mejlmottagare.';

      let yes = "Skicka";
      let no = "Avbryt";
      $ ('#navKeys').text ('false'); // Prevents prev/next-picture use of L/R arrows
      let dialogId = "dialog";
      let id = "#" + dialogId;
      $ (id).dialog ( { // Initiate dialog
        title: "", // html set below /#/
        closeText: "×",
        autoOpen: false,
        draggable: true,
        modal: false,
        closeOnEscape: true,
      });
      later ( ( () => {
        $ (id).html (text);
        // Define button array
        $ (id).dialog ('option', 'buttons', [
        {
          text: yes,
            id: "sendBut",
          click: function () {
            let from = document.querySelector ("input.i_address").value.trim ().replace (/\s+/g, " ");
            let email = document.querySelector ("input.i_email").value;
            if (emailOk (email)) {
              $ ("input.i_email").css ("background", "#dfd");
            } else {
              $ ("input.i_email").css ("background", "#fdd");
              $ ("input.i_email").focus ();
              //$ ('#navKeys').text ('false'); // Repeated since non-modal
              return;
            }
            let message = document.querySelector ("textarea.t_mess").value.trim ().replace (/\s+/g, " ");
            if (message.length < 7) {
              $ ("textarea.t_mess").css ("background", "#fdd");
              $ ("textarea.t_mess").focus ();
              //$ ('#navKeys').text ('false'); // Repeated since non-modal
              return;
            }
            $ (this).dialog ("close");
            $ ('#navKeys').text ('true'); // Reset when L/R arrows have been protected
            // Send email from server
            let data = new FormData ();
            data.append ("title", extractContent (title));
            data.append ("username", user);
            data.append ("picturename", picName);
            data.append ("mailtoadmin", mailAdmin);
            data.append ("from", from);
            data.append ("email", email);
            data.append ("message", message);
            return new Promise ( (resolve, reject) => {
              let xhr = new XMLHttpRequest ();
              xhr.open ('POST', 'contact/')
              xhr.onload = function () {
                resolve (xhr.responseText); // empty
              };
              xhr.onerror = function () {
                resolve (xhr.statusText);
                reject ({
                  status: this.status,
                  statusText: xhr.statusText
                });
              };
              xhr.send (data);
              infoDia (null, null, title, "<br>Ditt meddelande är skickat!", "Ok"); // i18n
            });
          }
        },
        {
          text: no,
            id: "cancelBut",
          click: function () {
            $ (this).dialog ("close");
            $ ('#navKeys').text ('true'); // Reset when L/R arrows have been protected
            //return;
          }
        }]);
        $ ("div[aria-describedby='" + dialogId + "'] span.ui-dialog-title").html (title); /#/
        niceDialogOpen (dialogId);
      }), 33);
      later ( ( () => {
        $ ("input.i_address").focus ();
      }), 333);
    },
    //============================================================================================
    infStatus () { // ##### Display permissions with the picture allow.jpg
      var title = "Information om användarrättigheter"; // i18n
      var text = '<img src="allow.jpg" title="Användarrätigheter">'; // i18n
      var yes = "Ok" // i18n
      infoDia (null, null, title, text, yes, false);
    },
    //============================================================================================
    //subaSelect (subName) { // ##### Sub-album link selected

    //},
    //============================================================================================
    subaSelect (subName) { // ##### Sub-album link selected
      subName = subName.replace (/&nbsp;/g, "_"); // Restore readable album name
      // NOTE: That restoring may be questionable with " " instead of "&nbsp;"
      spinnerWait (true);
      document.getElementById ("stopSpin").innerHTML = "";
      stopSpinStopSpin ();
      let names = $ ("#imdbDirs").text ().split ("\n");
      let name = $ ("#imdbDir").text ().slice ($ ("#imdbLink").text ().length); // Remove imdbLink
      let here, idx;
      if (subName === "|«") { // go to top in tree
        idx = 0;
      } else if (subName === "«") { // go up in tree
        name = name.replace (/((\/[^/])*)(\/[^/]*$)/, "$1");
        idx = names.indexOf (name);
      } else if (subName === "‹›") { // go to most recent
        idx = savedAlbumIndex;
      } else {
        here = names.indexOf (name);
        idx = names.slice (here + 1).indexOf (name + "/" + subName);
        if (idx < 0) {
          $ (".mainMenu").hide ();
        } else {
          idx = idx + here + 1;
        }
      }
      if (idx < 0) {
        $ (".mainMenu").hide ();
        return;
      } else {
        // NOTE: jstree uses (calls) selectAlbum (see the HBS file)
        // NOTE!
        selectJstreeNode (idx);
        // NOTE!
        // NOTE: jstree uses (calls) selectAlbum (see the HBS file)
      }
    },
    //============================================================================================
    setAllow (newSetting) { // ##### Updates settings checkbox menu and check reordering attributes
      allowvalue = $ ("#allowValue").text ();
      var n = allowvalue.length;

      if (newSetting) { // Uppdate allowvalue from checkboxes
        var a = "";
        for (var i=0; i<n; i++) {
          var v = String (1 * $ ('input[name="setAllow"]') [i].checked);
          a += v;
        }
        allowvalue = a;
        $ ("#allowValue").text (allowvalue);
      }

      function code (i, j) {
        if (i) {
          return '<input id="c' + (j + 1) + '" type="checkbox" name="setAllow" checked value=""><label for="c' + (j + 1) + '"></label>';
        } else { // The label tags are to satisfy a CSS:checkbox construct, see app.css
          return '<input id="c' + (j + 1) + '" type="checkbox" name="setAllow" value=""><label for="c' + (j + 1) + '"></label>';
        }
      }
      var allowHtml = [];
      for (var j=0; j<n; j++) {
        // Original
        //allowHtml [j] = "<span>allow." + allowance [j] + " " + (j + 1) + ' </span>' + code (Number (allowvalue [j]), j);
        // Swedish
        allowHtml [j] = "<span>" + allowSV [j] + " " + (j + 1) + ' </span>' + code (Number (allowvalue [j]), j); // i18n
      }
      $ ("#setAllow").html ( allowHtml.join ("<br>"));


      allowFunc ();

      if (newSetting) { // Allow only one confirmation per settings-view
        disableSettings ();
        later ( ( () => {
          $ ("div.settings, div.settings div.check").hide ();
        }), 500);
      }

      if (allow.imgReorder || allow.adminAll) { // Allow reorder and ...
        $ ("div.show-inline.ember-view").attr ("draggable", "true");
        $ ("div.show-inline.ember-view").attr ("onmousedown", "return true");
      } else { // ... disallow reorder, onmousedown setting is important!
        $ ("div.show-inline.ember-view").attr ("draggable", "false");
        $ ("div.show-inline.ember-view").attr ("onmousedown", "return false");
      }
      $ ("div.settings button.confirm").blur (); // Important in some situations
    },
    //============================================================================================
    albumEdit () { // ##### Erase or create (sub)albums (image folders)

      var imdbDir = $ ("#imdbDir").text ();
      if (imdbDir === "—" || imdbDir === "") return;
      // Extract the album name and replace &nbsp; with space:
      var album = $ (this.get ("albumName")).text ().replace (/\s/g, " ");
      var album1 = $ ("#picFound").text ().replace (/_/g, " ");
      if ( (!(allow.albumEdit || allow.adminAll)) || album === album1) {
        userLog ("RÄTTIGHET SAKNAS", true, 1000);
        return;
      }
      $ (".mainMenu").hide ();
      $ ("iframe").hide ();
      $ (".img_show").hide ();
      $ (".nav_links").hide ();
      var imdbRoot = $ ("#imdbRoot").text ();
      if (imdbDir.indexOf ("/") < 0) {
        imdbDir = imdbRoot;
      } else {
        imdbDir = imdbDir.replace (/^[^/]*\//, imdbRoot + "/");
      }

      $ ("#temporary").text ("");
      $ ("#temporary_1").text ("");
      // The code in this dialog will indirectly call albumEditOption () onchange:
      var code0 = '<span>' + imdbDir + '</span><br>';
      code0 += '<select class="selectOption" onchange=';
      code0 += "'$ (\"#temporary\").text (this.value);$ (\"#albumEditOption\").click ();return false'>";
      var code = code0 + '\n<option value="">&nbsp;Välj åtgärd för albumet&nbsp;</option>';
      if (imdbDir.indexOf (picFound) < 0) {
        code += '\n<option value="new">&nbsp;Gör ett nytt underalbum  &nbsp;</option>';
      }
      if (imdbDir !== imdbRoot && imdbDir.indexOf (picFound) < 0) {
        code += '\n<option value="erase">&nbsp;Radera albumet&nbsp;</option>';
      }
      if ($ (".img_mini").length > 1) {
        code += '\n<option value="order">&nbsp;Sortera bilderna efter namn&nbsp;</option>';
        code += '\n<option value="reverse">&nbsp;Sortera bilderna baklänges&nbsp;</option>';
      } else if (imdbDir.indexOf (picFound) > -1) {
        code = code0 + '\n<option value="">&nbsp;Albumet kan inte åtgärdas!&nbsp;</option>';
      }
      code += '\n</select>';
      infoDia (null, null, album, code, 'Avbryt', true);
      later ( ( () => {
        $ ("select.selectOption").focus ();
      }), 50);
    },
    //============================================================================================
    albumEditOption () { // Executes albumEdit()'s selected option
      var opt = $ ("#temporary").text ();
      var chkName = $ ("#temporary_1").text ();
      var nameText = $ ("#imdbDir").text ().replace (/^(.+[/])+/, "");
      if (nameText === $ ("#imdbLink").text ()) {nameText = $ ("#imdbRoot").text ();}
      var header, optionText, okay, cancel;
      if (opt) {
        if (opt === "new" || opt === "checked") {
          header = nameText;
          optionText = "Lägg till ett nytt underalbum i <b>" + nameText + "</b><br>";
          optionText += "Välj det nya albumnamnet:<br>";
          optionText += '<input type="text" class="cred user nameNew" size="36" title="" placeholder="skriv albumnamn" value="' + chkName + '" style="margin-top: 1em">'
          if (chkName && !acceptedDirName (chkName)) {optionText += "<br>(ej godkänt albumnamn)";}
          okay = "Fortsätt";
          if (opt === "checked") {okay = "Slutför";}
          cancel = "Avbryt";
        }
        if (opt === "erase") {
          header = "Radera " + nameText; // i18n
          optionText = "<b>Vänligen bekräfta:</b><br>Albumet <b>" + nameText + "<br>ska alltså raderas?</b><br>(<i>kan inte ångras</i>)"; // i18n
          okay = "Ja";
          cancel = "Nej";
        }
        if (opt === "order") {
          header = "Sortera i bildnamnordning"; // i18n
          optionText = "<b>Vänligen bekräfta:</b><br>Bilderna i <b>" + nameText + "<br>ska alltså sorteras i namnordning?</b><br>(<i>kan inte ångras</i>)"; // i18n
          okay = "Ja";
          cancel = "Nej";
        }
        if (opt === "reverse") {
          header = "Sortera i omvänd bildnamnordning"; // i18n
          optionText = "<b>Vänligen bekräfta:</b><br>Bilderna i <b>" + nameText + "<br>ska alltså sorteras i omvänd namnordning?</b><br>(<i>kan inte ångras</i>)"; // i18n
          okay = "Ja";
          cancel = "Nej";
        }
        $ ("#dialog").html (optionText);
        $ ("#dialog").dialog ( { // Initiate a new, confirmation dialog
          title: header,
          closeText: "×",
          autoOpen: false,
          draggable: true,
          modal: true,
          closeOnEscape: true
        });
        var pathNew = $ ("#imdbDir").text () + "/"
        var that = this;
        $ ("#dialog").dialog ('option', 'buttons', [ // Define button array
        {
          text: okay, // Yes
          "id": "yesBut",
          click: function () {

            if (opt === "new") {
              // Check the proposed album name:
              var nameNew = document.querySelector ("input.nameNew").value;
              nameNew = nameNew.replace (/"/g, "?");
              nameNew = nameNew.replace (/ /g, "_");
              while (nameNew.indexOf ("__") > -1) {
                nameNew = nameNew.replace (/__/g, "_");
              }
              if (nameNew === "_") {nameNew = "";}
              if (nameNew.length > 0 && acceptedDirName (nameNew)) {
                $ ("#temporary").text ("checked");
                $ ("#temporary_1").text (nameNew);
                $ (this).dialog ("close");
                later ( ( () => {
                  $ ("#albumEditOption").click ();
                  later ( ( () => {
                    document.querySelector ("input.nameNew").disabled = true;
                    var tmp = document.querySelector ("input.nameNew").getAttribute ("style");
                    document.querySelector ("input.nameNew").setAttribute ("style", tmp + ";background:#dfd");
                    //$ ("input.nameNew").attr ("background-color", "#efe");
                  }), 100);
                }), 100);
                //console.log ("Nytt album: " + $ ("#imdbDir").text () + "/" + nameNew);
              } else {
                console.log ("Improper name: " + nameNew);
                $ ("#temporary_1").text (nameNew);
                $ (this).dialog ("close");
                later ( ( () => {
                  $ ("#albumEditOption").click ();
                }), 100);
              }

            } else if (opt === "checked") {
              nameNew = $ ("#temporary_1").text ();
              var cmd = "mkdir " + pathNew + nameNew + " && touch " + pathNew + nameNew + "/.imdb";
              console.log (cmd);
              mexecute (cmd).then (result => {
                if (result) {
                  var album = $ (that.get ("albumName")).text ();
                  later ( ( () => {
                    infoDia (null, null, album, "<b>Misslyckades: </b>" + pathNew + "<b>" + nameNew + "</b> finns redan<br>" + result, "Ok", true);
                  }), 100);
                } else {
                  console.log ("Album created: " + nameNew);
                  userLog ("CREATED " + nameNew + ", RESTARTING", 10000);
                  later ( ( () => {
                    location.reload ();
                  }), 2000);
                }
              });

            } else if (opt === "erase") {
              // Ignore hidden (dotted) files
              cmd = "ls -1 " + $ ("#imdbDir").text ()
              execute (cmd).then (res => {
                res = res.split ("\n");
                var n = 0;
                for (let i=0; i<res.length; i++) {
                  var a = res [i].trim ()
                  if (!(a == '' || a.indexOf ("_imdb_") === 0 || a.indexOf ("_mini_") === 0 || a.indexOf ("_show_") === 0 )) {n++;}
                }
                // If n==0, any hidden (dotted) files are deleted along with _imdb_ files etc.
                if (n) {
                  $ (this).dialog ("close");
                  var album = $ (that.get ("albumName")).text ();
                  later ( ( () => {
                    infoDia (null, null, album, " <br><b>Albumet måste tömmas</b><br>för att kunna raderas", "Ok", true);
                  }), 100);
                } else {
                  cmd = "rm -rf " + $ ("#imdbDir").text ();
                  console.log (cmd);
                  execute (cmd).then ( () => {
                    userLog ("DELETED " + nameText + ", RESTARTING");
                    later ( ( () => {
                      location.reload ();
                    }), 2000);
                  });
                }
              });
            } else if (opt === "order" || opt === "reverse") {
              let sortop = "sort -f "; // -f is ignore case
              if (opt === "reverse") sortop = "sort -rf "
              $ ("#saveOrder").click ();
              later ( ( () => {
                cmd = sortop + $ ("#imdbDir").text () + "/_imdb_order.txt > /tmp/tmp && cp /tmp/tmp " + $ ("#imdbDir").text () + "/_imdb_order.txt";
                execute (cmd).then ( () => {
                  later ( ( () => {
                    $ ("#reLd").click ();
                  }), 500);
                });
              }), 2000);
            }
            $ (this).dialog ("close");
          }
        },
        {
          text: cancel, // No
          "id": "noBut",
          click: function () {
            if (opt === "new") {
              // do nothing
            } else if (opt === "checked") {
              $ ("#temporary").text ("new");
              $ (this).dialog ("close");
              later ( ( () => {
                $ ("#albumEditOption").click ();
                later ( ( () => {
                  document.querySelector ("input.nameNew").value = $ ("#temporary_1").text ();
                }), 100);
              }), 100);

            } else if (opt === "erase") {
              console.log ("Untouched: " + nameText);
            } else if (opt === "order" || opt === "reverse") {
              // do nothing
            }
            $ (this).dialog ("close");
          }
        }]);
        niceDialogOpen ();
        $ ("#noBut").focus ();
        $ ("input.nameNew").focus (); // if exists
        if (opt === "checked") {$ ("#yesBut").focus ();}
      }
    },
    //============================================================================================
    // ##### Check file base names against a server directory & modify command(s), NOTE:
    // checkNames uses 1) the server directory in #temporary and 2) the commands in #temporary_1
    checkNames () {
      later ( ( () => {
        var lpath =  $ ('#temporary').text (); // <- the server dir
        getBaseNames (lpath).then (names => {
          //console.log("checkNames:", names);
          var cNames = $ ("#picNames").text ().split ("\n"); // <- the names to be checked
          var cmds = $ ('#temporary_1').text ().split ("\n"); // <- corresp. shell commands
          chkPaths = [];
          for (var i=0; i<cNames.length; i++) {
            if (names.indexOf (cNames [i]) > -1) { // comment out if the file already exists:
              cmds [i] = cmds [i].replace (/^[^ ]+ [^ ]+ /, "#exists already: ");
              userLog ("NOTE exists");
            } else {
              let cmdArr = cmds [i].split (" ");
              if (cmdArr [0] === "mv") {
                chkPaths.push (cmdArr [2]);
                chkPaths.push (cmdArr [cmdArr.length - 1] + cmdArr [2].replace(/^([^/]*\/)*/, ""));
              }
            }
          }
          $ ('#temporary_1').text (cmds.join ("\n"));
        });
      }), 100);
      // Somewhere later, 'sqlUpdate (chkPaths)' will be called, from refresh ()
    },
    //============================================================================================
    hideSpinner () { // ##### The spinner may be clicked away if it renamains for some reason

      spinnerWait (false);
      userLog ("STOP spin");
    },
    //============================================================================================
    speedBase () { // ##### Toogle between seconds/textline and seconds/picture

      // Deppink triggers seconds/textline
      var colorText = $ (".nav_links span a.speedBase").css ('color');
      //console.log (colorText);
      if ( colorText !== 'rgb(255, 20, 147)') { // not deeppink but gray or hoover-color
        $ (".nav_links span a.speedBase").css ('color', 'deeppink'); // 'rgb(255, 20, 147)'
      } else {
        $ (".nav_links span a.speedBase").css ('color', 'gray'); // 'rgb(128, 128, 128)'
      }
    },
    //============================================================================================
    selectRoot (value, what) { // ##### Select album root dir (to put into imdbLink) from dropdown
//console.log(value, what);
      if (what) {var that = what;} else that = this;
      $ (".mainMenu p:gt(1)").hide ();
      //$ (".mainMenu p:gt(1)").show ();
      // Close all dialogs/windows
      $ ("#dialog").dialog ("close");
      $ ("#searcharea").dialog ("close");
      ediTextClosed ();
      $ (".img_show").hide ();
      $ (".nav_links").hide ();
      //document.getElementById ("imageList").className = "hide-all";
      document.getElementById ("divDropbox").className = "hide-all";
      if (value.indexOf (" ") > -1) value = ""; // The header line contains space
//console.log(value, what);
      if (value === "") {
        $ (".mainMenu p:gt(1)").show ();
        return;
      }
//console.log(value, what); YOU HAVE TO set the right OPTION!
      $ ("#rootSel option[value=" + value + "]").prop('selected', 'selected');
      $ ("#imdbRoot").text (value);
      that.set ("imdbRoot", value);
      that.set ("albumData", []); // Triggers jstree rebuild in requestDirs
      $ ("#imdbDirs").text ("");
      $ ("#imdbDir").text ($ ("#imdbLink").text ());
      $ ("#requestDirs").click (); // perform ...
      later ( ( () => {
        // Send #imdbRoot and picFound to the server with this GET:
        // (the server needs #picFound base name for old file cleaning)
        return new Promise ( (resolve) => {
          var xhr = new XMLHttpRequest ();
          xhr.open ('GET', 'imdbroot/' + value + "@" + picFound, true, null, null);
          xhr.onload = function () {
            resolve (true);
          };
          xhr.send ();
        }).catch (error => {
          if (error.status !== 404) {
            console.error (error.message);
          } else {
            console.log (error.status, error.statusText, "or NodeJS server error?");
          }
        }).then ( () => {
          var imdbroot = $ ("#imdbRoot").text ();
          if (imdbroot) {
            $ (".mainmenu, .mainMenu p").show ();
            $ (".ember-view.jstree").jstree ("deselect_all");
            $ (".ember-view.jstree").jstree ("close_all");
            $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
            $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_1"));
            userLog ("START " + imdbroot);
          }
        }).then ( () => {
          startInfoPage ()
        });
      }), 2000); // Time needed!
    },
    //============================================================================================
    selectAlbumNew () {
      if ($ ("#imdbDir").text ()) return;
      else this.actions.selectAlbum ();
    },
    //============================================================================================
    selectAlbum () {
//console.log('#1',this);
      let value = $ ("[aria-selected='true'] a.jstree-clicked");
      if (value && value.length > 0) {
        value = $ ("#imdbLink").text () + value.attr ("title").toString ().slice (1);
      } else {
        value = "";
      }
      // Do not hide the introduction page at very first view
      if (value !== $ ("#imdbLink").text ()) {
        $ ("iframe").hide ();
      }
      ediTextClosed ();
      spinnerWait (true);
      document.getElementById ("stopSpin").innerHTML = "";
      stopSpinStopSpin ();

      $ ("div.ember-view.jstree").attr ("onclick", "return false");
      $ ("ul.jstree-container-ul.jstree-children").attr ("onclick", "return false");
      new Promise (resolve => {
        $ ("a.jstree-anchor").blur (); // Important?
        let linLen = $ ("#imdbLink").text ().length
        if (value !== $ ("#imdbDir").text ()) {
          // save the index of the preceeding album
          savedAlbumIndex = $ ("#imdbDirs").text ().split ("\n").indexOf ($ ("#imdbDir").text ().slice (linLen));
          $ ("#backImg").text ("");
          $ ("#picName").text ("");
          $ ("#picOrig").text ("");
          $ ("#sortOrder").text ("");
          $ (".showCount").hide ();
//          $ (".miniImgs").hide (); // NOTE: Vad är detta?????
        }
        let imdbDir = value;
        $ ("#imdbDir").text (value);
        let selDir = value.slice (linLen);
        let selDirs = $ ("#imdbDirs").text ().split ("\n");
        let selPics = $ ("#imdbLabels").text ().split ("\n");
        let tmp = [""]; // root
        let tmp1 = [""];
        if (selDir) { // not root
          tmp = ["|«", "«", "‹›"];
          tmp1 = ["", "", ""];
        }
        let i0 = selDirs.indexOf (selDir);
        for (let i=i0; i<selDirs.length; i++) {
          if (selDir === selDirs [i].slice (0, selDir.length)) {
            let cand = selDirs [i].slice (selDir.length);
            if (cand.indexOf ("/") === 0 && cand.replace (/^(\/[^/]+).*$/, "$1") === cand) {
              if (cand.slice (1) !== $ ("#picFound").text ()) {
                //tmp.push (cand.slice (1).replace (/_/g, " "));
                tmp.push (cand.slice (1));
                tmp1.push (selPics [i]);
              }
            }
          }
        }
        if (tmp [0] === "") {
          if (savedAlbumIndex > 0) {
            tmp [0] = "‹›";
          } else {
            tmp = tmp.slice (1); // at root
            tmp1 = tmp1.slice (1); // at root
          }
        }
        var Aobj = EmberObject.extend ({
          album: '',
          image: '',
          name: ''
        }); // NOTE: For the album menu rows in *.hbs (a.imDir)
        let a = [];
        for (let i=0; i<tmp.length; i++) {
          a [i] = Aobj.create ({
            album: tmp [i],
            image: tmp1 [i],
            name: tmp [i].replace (/_/g, " ")
          });
        }
        let tmp2 = [""];
        if (value) {tmp2 = value.split ("/");}
        if (tmp2 [tmp2.length - 1] === "") {tmp2 = tmp2.slice (0, -1)} // removes trailing /
        tmp2 = tmp2.slice (1); // remove symbolic link name
        if (typeof this.set === 'function') {
          if (tmp2.length > 0) {
//console.log('#2',this);
//this.actions.settest (this);
            this.set ("albumName", tmp2 [tmp2.length - 1]);
          } else {
            this.set ("albumName", this.get ("imdbRoot"));
          }
        }
        $ ("#refresh-1").click ();
        if (value) {
          $ (".imDir.path").attr ("title-1", albumPath ());
        }
        this.set ("subaList", a);

        later ( ( () => {
          $ ("a.imDir").attr ("title", "Album");
          let n = $ ("a.imDir").length/2; // there is also a page bottom link line...
          let nsub = n;
          let z, iz, obj;
          let fullAlbumName= $ ("#imdbRoot").text () + $ ("#imdbDir").text ().replace (/^[^/]*/, "");
          fullAlbumName = '<span title-1="' + fullAlbumName+ '">' + this.get ("albumName") + ": </span>"
          if (tmp [0] === "|«") {
            $ ("a.imDir").each (function (index, element) {
              if (index < n) {z = 0;} else {z = n;}
              iz = index - z;
              if (iz < 3) {
                $ (element).attr ("title", returnTitles [iz]);
                $ (element).closest ("div.subAlbum").attr ("title", returnTitles [iz]);
                if (!z) {
                  nsub--;
                  obj = $ (element).closest ("div.subAlbum");
                  obj.addClass ("BUT_1");
                  if (iz === 2) {
                    if ( $ ("#imdbDir").text ().replace (/^[^/]*\//, "").indexOf (picFound) === 0) {
                      obj.after ("<div class=\"BUT_2\"> Tillfälligt album utan underalbum</div><br>"); // i18n
                    } else if (nsub < 1) {
                      obj.after ("<div class=\"BUT_2\"> Har inga underalbum</div><br>"); // i18n
                    } else if (nsub === 1) {
                      obj.after ("<div class=\"BUT_2\"> Har ett underalbum</div><br>"); // i18n
                    } else {
                      obj.after ("<div class=\"BUT_2\"> Har " + nsub + " underalbum</div><br>"); // i18n
                    }
                    obj.after (fullAlbumName);
                  }
                }
              }
            });
          } else if (tmp [0] === "‹›") {
            $ ("a.imDir").each (function (index, element) {
              if (index < n) {z = 0;} else {z = n;}
              iz = index - z;
              if (iz === 0) {
                $ (element).attr ("title", returnTitles [index + 2]);
                $ (element).closest ("div.subAlbum").attr ("title", returnTitles [index + 2]);
                if (!z) {
                  nsub--;
                  obj = $ (element).closest ("div.subAlbum");
                  obj.addClass ("BUT_1");
                  if ( $ ("#imdbDir").text ().replace (/^[^/]*\//, "").indexOf (picFound) === 0) {
                    obj.after ("<div class=\"BUT_2\"> Tillfälligt album utan underalbum</div><br>"); // i18n
                  } else if (nsub < 1) {
                    obj.after ("<div class=\"BUT_2\"> Har inga underalbum</div><br>"); // i18n
                  } else if (nsub === 1) {
                    obj.after ("<div class=\"BUT_2\"> Har ett underalbum</div><br>"); // i18n
                  } else {
                    obj.after ("<div class=\"BUT_2\"> Har " + nsub + " underalbum</div><br>"); // i18n
                  }
                  obj.after (fullAlbumName);
                }
              }
            });
          } else {
            obj = $ ("div.subAlbum").first ();
            obj.before (fullAlbumName);
            if ( $ ("#imdbDir").text ().replace (/^[^/]*\//, "").indexOf (picFound) === 0) {
              obj.after ("<div class=\"BUT_2\"> Tillfälligt album utan underalbum</div><br>"); // i18n
            } else if (nsub < 1) {
              obj.before ("<div class=\"BUT_2\"> Har inga underalbum</div><br>"); // i18n
            } else if (nsub === 1) {
              obj.before ("<div class=\"BUT_2\"> Har ett underalbum</div><br>"); // i18n
            } else {
              obj.before ("<div class=\"BUT_2\"> Har " + nsub + " underalbum</div><br>"); // i18n
            }
          }
//console.log("¤¤¤",$ ("#imdbRoot").text (),$ ("#imdbDir").text ());
          // Don't show imdbLink (album root symlink name)
          console.log ("Album " + imdbDir.replace (/^[^/]*/, ".") + ", nsub = " + nsub);

          resolve (true);
          later ( ( () => {
            // Don't hide login (at top) if we have 0/top position!
            // If not, adjust the position, login remains hidden at window top.
            if (0 < window.pageYOffset) {
              scrollTo (null, $ ("#highUp").offset ().top);
            }
          }), 50);
        }), 777);
      }).then ( () => {
      /*}).catch (error => {
        console.error (error.message);*/
      });
    },
    //============================================================================================
    settest (what) {
      console.log('#3',what);
    },
    //============================================================================================
    toggleMainMenu () {

      $ ("div.ui-tooltip-content").remove (); // May remain unintentionally ...
      $ ("iframe").hide ();
      document.getElementById ("divDropbox").className = "hide-all";
      //var that = this;
      $ ("div.settings, div.settings div.check").hide ();
      if (!$ (".mainMenu").is (":visible")) {
        $ (".mainMenu").show ();
      } else {
        $ (".mainMenu").hide ();
      }
    },
    //============================================================================================
    toggleJstreeAlbumSelect () {

      $ ("div.ui-tooltip-content").remove (); // May remain unintentionally ...
      if (!$ (".jstreeAlbumSelect").is (":visible")) {
        $ (".jstreeAlbumSelect").show ();
      } else {
        $ (".jstreeAlbumSelect").hide ();
      }
    },
    //============================================================================================
    toggleHideFlagged () { // #####

      if ($ ("#sortOrder").text () === "") return;
      if (!(allow.imgHidden || allow.adminAll)) {
        userLog ("HIDDEN protected");
        return;
      }
      return new Promise ( (resolve) => {
        $ ("#link_show a").css ('opacity', 0 );

        if ($ ("#hideFlag").text () === "1") {
          $ ("#hideFlag").text ("0");
          this.actions.hideFlagged (false).then (null); // Show all pics
        } else {
          $ ("#hideFlag").text ("1");
          this.actions.hideFlagged (true).then (null); // Hide the flagged pics
        }
        resolve ("OK");
      }).then (null).catch (error => {
        console.error (error.message);
      });

    },
    //============================================================================================
    hideFlagged (yes) { // #####

      $ ("div.ui-tooltip-content").remove (); // May remain unintentionally ...
     return new Promise ( (resolve) => {

      $ ("#link_show a").css ('opacity', 0 );
      var tmp = $ ('#sortOrder').text ().trim ();
      if (tmp.length < 1) return;
      var rows = tmp.split ('\n');
      var n = 0, h = 0;
      for (var i=0; i<rows.length; i++) {
        var str = rows [i].trim ();
        var k = str.indexOf (",");
        var name = str.substring (0, k);
        str = str.slice (k+1);
        k = str.indexOf (",");
        var hideFlag = 1*str.substring (0, k); // Used as 1 = hidden, 0 = shown
        str = str.slice (k+1);
        //var albumIndex = 1*str;
        //var dummy = albumIndex; // Not yet used
        var nodelem = document.getElementById ("i" + name);
        if (nodelem) {
          n = n + 1;
          if (hideFlag) {
            nodelem.style.backgroundColor=$ ("#hideColor").text ();
            if (yes) {
              nodelem.style.display='none';
            }
            h = h + 1;
          } else {
            //nodelem.style.backgroundColor='#222';
            nodelem.style.backgroundColor=$ ("#bkgrColor").text ();
            if (yes) {
              nodelem.style.display='block-inline';
            }
          }
        }
      }
      if (yes) {
        $ ('.showCount .numShown').text (" " + (n - h));
        $ ('.showCount .numHidden').text (" " + h);
        //$ ('#toggleHide').css ('color', 'lightskyblue');
        $ ('#toggleHide').css ('background-image', 'url(/images/eyes-blue.png)');
      } else {
        $ ('.showCount .numShown').text (" " + n);
        $ ('.showCount .numHidden').text (' 0');
        //$ ('#toggleHide').css ('color', 'white');
        $ ('#toggleHide').css ('background-image', 'url(/images/eyes-white.png)');
        $ (".img_mini").show (); // Show all pics
      }
      $ ('.showCount .numMarked').text ($ (".markTrue").length + " ");

      var lineCount = parseInt ($ (window).width ()/170); // w150 +> w170 each pic
      $ ('.showCount').hide ();
      $ ('.showCount:first').show (); // Show upper
      $ ("#toggleName").hide ();
      $ ("#toggleHide").hide ();
      if (n > 0) {
        $ ("#toggleName").show ();
        if (allow.adminAll || allow.imgHidden) $ ("#toggleHide").show ();
        $ ("span.ifZero").show ();
        if ( (n - h) > lineCount) {$ ('.showCount').show ();} // Show both
      } else {
        $ ("span.ifZero").hide ();
      }

      resolve ("OK");

     }).catch (error => {
      console.error (error.message);
     });

    },
    //============================================================================================
    showDropbox () { // ##### Display (toggle) the Dropbox file upload area

      $ ("div.ui-tooltip-content").remove (); // May remain unintentionally ...
      if ($ ("#imdbDir").text () === "") return;
      if ($ (".toggleAuto").text () === "STOP") return; // Auto slide show is running
      $ ("iframe").hide ();
      $ (".mainMenu").hide ();
      $ ("#link_show a").css ('opacity', 0 );
      if (document.getElementById ("divDropbox").className === "hide-all") {
        document.getElementById ("divDropbox").className = "show-block";
        $ ("div.settings, div.settings div.check").hide ();
        this.actions.hideShow ();
        $ ("#dzinfo").html ("VÄLJ FOTOGRAFIER FÖR UPPLADDNING"); // i18n
        scrollTo (null, $ ("#highUp").offset ().top);
        if (allow.imgUpload || allow.adminAll) {
          document.getElementById("uploadPics").disabled = false;
        } else {
          document.getElementById("uploadPics").disabled = true;
          userLog ("UPLOAD prohibited");
        }
      } else {
        document.getElementById ("divDropbox").className = "hide-all";
        document.getElementById("reLd").disabled = false;
        document.getElementById("saveOrder").disabled = false;
        scrollTo (null, $ ("#highUp").offset ().top);
      }
    },
    //============================================================================================
    imageList (yes) { // ##### Display or hide the thumbnail page

      $ ("#link_show a").css ('opacity', 0 );
      //if (yes || document.getElementById ("imageList").className === "hide-all") {
      if (yes) {
        document.getElementById ("imageList").className = "show-block";
      } else {
        document.getElementById ("imageList").className = "hide-all";
      }
    },
    //============================================================================================
    showShow (showpic, namepic, origpic) { // ##### Render a 'show image' in its <div>

      $ ("div.ui-tooltip-content").remove (); // May remain unintentionally ...
      $ (".mainMenu").hide ();
      $ ("div.settings, div.settings div.check").hide ();
      $ ("ul.context-menu").hide ();
      $ ("#i" + escapeDots (namepic) + " a img").blur ();
      $ ("#picName").text (namepic);
      $ ("#picOrig").text (origpic);
      //$ ("#picOrig").text ($ ("#imdbLink").text () +"/"+ $ ("#i" + escapeDots (namepic) + " a img").attr ("title"));
      resetBorders (); // Reset all borders
      markBorders (namepic); // Mark this one
      $ ("#wrap_show").removeClass ("symlink");
      if ($ ("#i" + escapeDots (namepic)).hasClass ("symlink")) {$ ("#wrap_show").addClass ("symlink");}
       $ ("#full_size").hide (); // button
      if (allow.imgOriginal || allow.adminAll) {$ ("#full_size").show ();}
      $ (".img_show .img_name").text ("");
      $ (".img_show .img_txt1").html ("");
      $ (".img_show .img_txt2").html ("");
      $ (".nav_links").hide ();
      $ ("#link_show a").css ('opacity', 0 );
      $ (".img_show img:first").attr ('src', showpic);
      $ (".img_show img:first").attr ("title", origpic.replace (/^[^/]+\//, ""));
      $ (".img_show .img_name").text (namepic); // Should be plain text
      $ (".img_show .img_txt1").html ($ ('#i' + escapeDots (namepic) + ' .img_txt1').html ());
      $ (".img_show .img_txt2").html ($ ('#i' + escapeDots (namepic) + ' .img_txt2').html ());
      // In search result view, show original path for editors:
      if (albumFindResult () && (allow.textEdit || allow.adminAll)) {
        execute ("readlink -n " + origpic).then (res => {
          res = res.replace (/^[^/]+\//, "./");
          $ ("#pathOrig").html ("&nbsp;Original: " + res);
        });
      } else {
        $ ("#pathOrig").text ("");
      }
      // The mini image 'id' is the 'trimmed file name' prefixed with 'i'
      if (typeof this.set === 'function') { // false if called from showNext
        var savepos = $ ('#i' + escapeDots (namepic)).offset ();
        if (savepos !== undefined) {
          $ ('#backPos').text (savepos.top); // Vertical position of the mini-image
        }
        $ ('#backImg').text (namepic); // The name of the mini-image
      }
      $ ("#wrap_show").css ('background-color', $ ('#i' + escapeDots (namepic)).css ('background-color'));
      $ (".img_show").show ();
      $ (".nav_links").show ();
      scrollTo (null, $ (".img_show img:first").offset ().top - $ ("#topMargin").text ());
      $ ("#markShow").removeClass ();
      if (document.getElementById ("i" + namepic).firstElementChild.nextElementSibling.className === "markTrue") {
        $ ("#markShow").addClass ("markTrueShow");
      } else {
        $ ("#markShow").addClass ("markFalseShow");
      }
      devSpec (); // Special device settings
      // Prepare texts for ediText dialog if not runAuto
      if ($ ("#navAuto").text () === "false") {
        if ($ ("#textareas").is (":visible")) {
          refreshEditor (namepic, origpic);
        }
        /*if ($ (".img_mini .img_name").css ("display") !== $ (".img_show .img_name").css ("display")) { // Can happen in a few situations
          $ (".img_show .img_name").toggle ();
        }*/
      }
      // Reset draggability for the texts (perhaps set to true somewhere by Jquery?)
      $ ("#wrap_show .img_txt1").attr ("draggable", "false");
      $ ("#wrap_show .img_txt2").attr ("draggable", "false");
      if ($ ("div[aria-describedby='dialog']").is (":visible") && $ ("div[aria-describedby='dialog'] div span").html () === "Information") showFileInfo ();
    },
    //============================================================================================
    hideShow () { // ##### Hide the show image element

      hideShow_g ();
    },
    //============================================================================================
    showNext (forwards) { // ##### SHow the next image if forwards is true, else the previous

      $ (".shortMessage").hide ();
      if (Number ($ (".numShown:first").text ()) < 2) {
        $ ("#navAuto").text ("false");
        $ ("#link_show a").blur ();
        return;
      }

      /*if ($ ("#navAuto").text () !== "true") {
      //if ($ ("div[aria-describedby='textareas']").css ("display") === "none") {
        $ ("#dialog").dialog ("close");
      }*/
      $ ("#link_show a").css ('opacity', 0 );

      var namehere = $ (".img_show .img_name").text ();
      var namepic, minipic, origpic;
      var tmp = document.getElementsByClassName ("img_mini");
      namepic = namehere;
      if (forwards) {
        while (namepic === namehere) {
          namepic = null;
          if (!document.getElementById ("i" + namehere) || !document.getElementById ("i" + namehere).parentElement.nextElementSibling) { // last
            namepic = tmp [0].getAttribute ("id").slice (1);
            userLog ("FIRST", false, 2000);
          } else {
            // here a problem:
            namepic = document.getElementById ("i" + namehere).parentElement.nextElementSibling.firstElementChild.id.slice (1);
          }
          if (document.getElementById ("i" + namepic).style.display === 'none') {
            namehere = namepic;
          }
        }
      } else {
        while (namepic === namehere) {
          namepic = null;
          if (!document.getElementById ("i" + namehere) || !document.getElementById ("i" + namehere).parentElement.previousElementSibling) { // first
            //var tmp = document.getElementsByClassName ("img_mini");
            namepic = tmp [tmp.length - 1].getAttribute ("id").slice (1);
            userLog ("LAST", false, 2000);
          } else {
            namepic = document.getElementById ("i" + namehere).parentElement.previousElementSibling.firstElementChild.id.slice (1);
          }
          if (document.getElementById ("i" + namepic).style.display === 'none') {
            namehere = namepic;
          }
        }
      }

      if (!namepic) return; // Maybe malplacé...
      var toshow = document.getElementById ("i" + namepic);
      minipic = toshow.firstElementChild.firstElementChild.getAttribute ("src");
      origpic = toshow.firstElementChild.firstElementChild.getAttribute ("title");
      origpic = $ ("#imdbLink").text () + "/" + origpic;
      var showpic = minipic.replace ("/_mini_", "/_show_");
      $ (".img_show").hide (); // Hide to get right savepos
      $ (".nav_links").hide ();
      var savepos = $ ('#i' + escapeDots (namepic)).offset ();
      if (savepos !== undefined) {
        $ ('#backPos').text (savepos.top); // Save position
      }
      $ ('#backImg').text (namepic); // Save name
      if (typeof this.set === "function") { // false if called from didInsertElement.
        this.actions.showShow (showpic, namepic, origpic);
      } else {                              // Arrow-key move, from didInsertElement
        this.showShow (showpic, namepic, origpic);
      }
      $ ("#link_show a").blur (); // If the image was clicked
    },
    //============================================================================================
    toggleAuto () { // ##### Start/stop auto slide show

      if (Number ($ (".numShown:first").text ()) < 2) {
        $ ("#navAuto").text ("false");
        return;
      }

      $ ("#dialog").dialog ("close");
      if ($ ("#imdbDir").text () === "") return;
      if ($ ("#navAuto").text () === "false") {
        $ ("#navAuto").text ("true");
        later ( ( () => {
          $ (".nav_links .toggleAuto").text ("STOP");
          $ (".nav_links .toggleAuto").attr ("title", "Avsluta bildbyte [Esc]"); //i18n
          this.runAuto (true);
          document.getElementById("reLd").disabled = true;
          document.getElementById("saveOrder").disabled = true;
        }), 500);
      } else {
        $ ("#navAuto").text ("false");
        later ( ( () => {
          $ (".nav_links .toggleAuto").text ("AUTO");
          $ (".nav_links .toggleAuto").attr ("title", "Automatiskt bildbyte [A]"); //i18n
          this.runAuto (false);
          document.getElementById("reLd").disabled = false;
          document.getElementById("saveOrder").disabled = false;
        }), 500);
      }
    },
    //============================================================================================
    refresh () { // ##### Reload the imageList and update the sort order
    //refresh (nospin) { // ##### Reload the imageList and update the sort order

      if ($ ("#imdbDir").text () === "") return;
      if ($ (".toggleAuto").text () === "STOP") return; // Auto slide show is running

      //if (!nospin) {
        spinnerWait (true);
        document.getElementById ("stopSpin").innerHTML = "";
        stopSpinStopSpin ();
      //}

      $ ("#link_show a").css ('opacity', 0 );
      //$ ("iframe").hide ();
      $ (".img_show").hide ();
      $ (".nav_links").hide ();
      this.refreshAll ().then ( () => {
        // Do not insert this temporary search result into the sql DB table:
        if (albumFindResult ()) {
          document.getElementById ("stopSpin").innerHTML = "SPIN-END";
          return true;
        }
        // Perform waiting DB updates
        if (chkPaths.length > 0) {
          sqlUpdate (chkPaths.join ("\n"));
        }
        chkPaths = randIndex (0); // Dummy use of randIndex (=> [])
        chkPaths = [];
      }).then ( () => {
        document.getElementById ("stopSpin").innerHTML = "SPIN-END";
        return true;
      });
    },
    //============================================================================================
    saveOrder () { // ##### Save, in imdbDir on server, the ordered name list for the thumbnails on the screen. Note that they may, by user's drag-and-drop, have an unknown sort order (etc.)

      if ($ (".toggleAuto").text () === "STOP") return; // Auto slide show is running
      if (!(allow.saveChanges || allow.adminAll) || $ ("#imdbDir").text () === "") return;

      $ ("#link_show a").css ('opacity', 0 );
      new Promise (resolve => {
        spinnerWait (true);
        var i =0, k = 0, SName = [], names, SN;
        SN = $ ('#sortOrder').text ().trim ().split ('\n'); // Take it from the DOM storage
        for (i=0; i<SN.length; i++) {
          SName.push (SN[i].split (",") [0]);
        }
        var UName = $ ('#uploadNames').text ().trim (); // Newly uploaded
        $ ('#uploadNames').text (''); // Reset
        var newOrder = '';
        // Get the true ordered name list from the DOM mini-pictures (thumbnails).
        names = $ (".img_mini .img_name").text ();
        names = names.toString ().trim ().replace (/\s+/g, " ");
        names = names.split (" ");
        for (i=0; i<names.length; i++) {
          k = SName.indexOf (names [i]);
          if (k > -1) {
            if (UName.indexOf (names[i]) > -1) {
              SN [k] = SN [k].replace (/,\d*,/, ',0,'); // Reset the hide flag for newly uploaded
            }
            newOrder = newOrder + '\n' + SN [k];
          } else {
            newOrder = newOrder + '\n' + names [i] + ',0,0';
          }
        }
        newOrder = newOrder.trim ();
        //$ ("#sortOrder").text (newOrder);
        later ( ( () => {
          if (saveOrderFunc) {
            saveOrderFunc (newOrder).then ( () => { // Save on server disk
              document.getElementById ("saveOrder").blur ();
              resetBorders (); // Reset all borders
            });
          }
          spinnerWait (false);
        }), 1500);
        resolve (true);
      }).catch (error => {
        console.error (error.message);
      });
    },
    //============================================================================================
    toggleNameView () { // ##### Toggle-view file names

      $ ("div.ui-tooltip-content").remove (); // May remain unintentionally ...
      $ ("#link_show a").css ('opacity', 0 );
      $ (".img_name").toggle ();
      if (document.getElementsByClassName ("img_name") [0].style.display === "none") {
        $ ("#hideNames").text ("1");
      } else {
        $ ("#hideNames").text ("0");
      }
    },
    //============================================================================================
    toggleHelp () { // ##### Toggle-view user manual

      $ ("div.ui-tooltip-content").remove (); // May remain unintentionally ...
      if ($ ("#helpText").is (":visible") || $ ("#navAuto").text () === "true") {
        $ ('#helpText').dialog ("close");
      } else {
        $ (".mainMenu").hide ();
        let header = "Användarhandledning<br>(främst för dator med mus eller pekplatta och tangentbord)"
        infoDia ("helpText", null, header, $ ("div.helpText").html (), "Stäng", false);
        $ ("#helpText").parent ().css ("top", "0");
      }
    },
    //============================================================================================
    toggleNav () { // ##### Toggle image navigation-click zones

      if ($ ("#navAuto").text () === "true") {
        var title = "Stanna automatisk visning...";
        var text = '<br> ... med <span style="color:deeppink;font-family:monospace;font-weight:bold">STOP</span> eller Esc-tangenten och börja visningen igen med <span style="color:deeppink;font-family:monospace;font-weight:bold">AUTO</span> eller A-tangenten!';
        var yes ="Ok";
        var modal = true;
        infoDia (null, null, title, text, yes, modal);
      } else if ($ ("#link_show a").css ('opacity') === '0' ) {
        $ ("#link_show a").css ('opacity', 1 );
      } else {
        $ ("#link_show a").css ('opacity', 0 );
      }
      devSpec ();

    },
    //============================================================================================
    toggleBackg () { // ##### Change theme light/dark

      let bgtheme = getCookie ("bgtheme");
      if (bgtheme === "light") {
        BACKG = "non0";
      } else {
        BACKG = "#000";
      }
      if ($ ("#imdbRoot").text ()) $ (".mainMenu").hide ();
      if (BACKG === "#000") {
        BACKG = "#cbcbcb";
        TEXTC = "#000";
        BLUET = "#146";
        setCookie ("bgtheme", "light", 0);
      } else {
        BACKG ="#000"; // background
        TEXTC = "#fff"; // text color
        BLUET = "#aef"; // blue text
        setCookie ("bgtheme", "dark", 0);
      }
      $ (".BACKG").css ("background", BACKG); // Repeat in didRender ()!
      $ (".TEXTC").css ("color", TEXTC); // Repeat in didRender ()!
      $ (".BLUET").css ("color", BLUET); // Repeat in didRender ()!
    },
    //============================================================================================
    findText () { // ##### Open dialog to search Xmp metadata text in the current imdbRoot

      if (!(allow.imgHidden || allow.adminAll)) {
        userLog ("LOCKED", true);
        return;
      }
      let diaSrch = "div[aria-describedby='searcharea']"
      if ($ (diaSrch).css ("display") !== "none") {
        $ ("#searcharea").dialog ("close");
      } else {
        if ($ ("#imdbRoot").text () === "") {
          userLog ("VÄLJ ALBUMKATALOG", true); //i18n
          return;
        }
        $ ("iframe").hide ();
        $ (".mainMenu").hide ();
        ediTextClosed ();
        $ (diaSrch).show ();
        //$ ("#searcharea").dialog ("open");
        niceDialogOpen ("searcharea");
        if (allow.albumEdit || allow.adminAll) $ ("#searcharea div.diaMess div.edWarn").html ("Sökdata...");
        //$ (".ui-dialog").attr ("draggable", "true"); // for jquery-ui-touch-punch, here useless?
        age_imdb_images ();
        let sw = parseInt ( (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth)*0.95);
        let diaSrchLeft = parseInt ( (sw - ediTextSelWidth ())/2) + "px";
        $ (diaSrch).css ("left", diaSrchLeft);
        $ (diaSrch).css ("max-width", sw+"px");
        $ (diaSrch).css ("width", "");
        $ ('textarea[name="searchtext"]').focus ();
        $ ('textarea[name="searchtext"]').select ();
        $ ("button.findText").html ("Sök i <b>" + $ ("#imdbRoot").text () + "</b>");
        $ ("button.findText").show ();
        $ ("button.updText").hide ();
        if (allow.albumEdit || allow.adminAll) {
          $ ("button.updText").show ();
          $ ("button.updText").css ("float", "right");
          $ ("button.updText").html ("Uppdatera söktexter");
          $ ("button.updText").attr ("title", "Förnya sökregistrets bildtexter");
        }
      }
    },
    //============================================================================================
    ediText (namepic) { // ##### Edit picture texts

      $ ("div.ui-tooltip-content").remove (); // May remain unintentionally ...
      var displ = $ ("div[aria-describedby='textareas']").css ("display");
      var name0 = $ ("div[aria-describedby='textareas'] span.ui-dialog-title span").html ();
      if (allow.textEdit || allow.adminAll) {
        $ ("button.saveTexts").attr ("disabled", false);
        $ (".img_txt1, .img_txt2").css ("cursor","pointer");
      } else {
        $ ("button.saveTexts").attr ("disabled", true);
        $ (".img_txt1, .img_txt2").css ("cursor","text");
        return; // Remove this line if TEXTPREVIEW for anyone is allowed!
      }
      if ($ ("#navAuto").text () === "true") return;
      $ ("#link_show a").css ('opacity', 0 );
      $ ('#navKeys').text ('false');
      // In case the name is given, the call originates in a mini-file (thumbnail)
      // Else, the call originates in, or in the opening of, a new|next show-file
      //   that may have an open 'textareas' dialog
      var origpic;
      if (namepic) {
        later ( ( () => {
          displ = $ ("div[aria-describedby='textareas']").css ("display");
          if (displ !== "none" && name0 === namepic) {
            ediTextClosed ();
            return;
          }
        }), 100);
        // NOTE: An ID string for 'getElementById' should have dots unescaped!
        origpic = document.getElementById ("i" + namepic).firstElementChild.firstElementChild.getAttribute ("title"); // With path
        origpic = $ ("#imdbLink").text () + "/" + origpic;

      } else {
        namepic = $ (".img_show .img_name").text ();
        // NOTE: An ID string for JQuery must have its dots escaped! CSS use!
        $ ("#backPos").text ($ ('#i' + escapeDots (namepic)).offset ().top);
        if ($ ("div[aria-describedby='textareas']").css ("display") !== "none") {
          ediTextClosed ();
          return;
        }
        origpic = $ (".img_show img:first").attr ("title"); // With path
        origpic = $ ("#imdbLink").text () + "/" + origpic;
      }
      var sw = ediTextSelWidth (); // Selected dialog width
      var tw = sw - 25; // Text width (updates prepTextEditDialog)
      $ ("#textareas textarea").css ("min-width", tw + "px");
      fileWR (origpic).then (acc => {
        //console.log("> acc:",acc);
        if (acc !== "WR") {
          infoDia (null, null,"Bildtexterna kan inte redigeras", "<br><span class='pink'>" + namepic + "</span> ändringsskyddad, försök igen<br><br>Om felet kvarstår:<br>Kontrollera filen!", "Stäng", true);
          $ ("div[aria-describedby='textareas']").hide ();
          return;
        }
      });
      $ ("#picName").text (namepic);
      displ = $ ("div[aria-describedby='textareas']").css ("display");

      // OPEN THE TEXT EDIT DIALOG and adjust some more details...
      later ( ( () => {
        $ ("#textareas").dialog ("open");
        $ ("div[aria-describedby='textareas']").show ();
        /*$ ("div[aria-describedby='textareas'] span.ui-dialog-title span").on ("click", () => { // Open if the name is clicked NOT USED
          later ( ( () => {
            var showpic = origpic.replace (/\/[^/]*$/, '') +'/'+ '_show_' + namepic + '.png';
            this.actions.showShow(showpic, namepic, origpic);
          }), 7);
        });*/

        $ ('textarea[name="description"]').attr ("placeholder", "Skriv bildtext: När var vad vilka (för Xmp.dc.description)");
        $ ('textarea[name="creator"]').attr ("placeholder", "Skriv ursprung: Foto upphov källa (för Xmp.dc.creator)");
      }), 50);

      refreshEditor (namepic, origpic); // ...and perhaps warnings

      resetBorders ();
      if (displ === "none") {
        // Prepare the extra "non-trivial" dialog buttons
        $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button.notes").css ("float", "left");
        $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button.notes").attr ("title", "... som inte visas");
        $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button.keys").css ("float", "right");
        $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button.keys").attr ("title", "Extra sökbegrepp");
        // Resize and position the dialog
        var diaDiv = "div[aria-describedby='textareas']"
        sw = parseInt ( (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth)*0.95);
        var diaDivLeft = parseInt ( (sw - ediTextSelWidth ())/2) + "px";
        $ (diaDiv).css ("top", "28px");
        $ (diaDiv).css ("left", diaDivLeft);
        $ (diaDiv).css ("max-width", sw+"px");
        $ (diaDiv).css ("width", "");
        let hs = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
        var up = 128;
        //var uy = $("div.ui-dialog");
        //var ui = $("div.ui-dialog .ui-dialog-content");
        var uy = $(diaDiv);
        var ui = $(diaDiv + " .ui-dialog-content");
        uy.css ("height", "auto");
        ui.css ("height", "auto");
        uy.css ("max-height", hs + "px");
        ui.css ("max-height", hs - up + "px");
        //uy.css ("top", hs - uy.height () - 13 + "px"); // Lower down...
      }
      $ (".mainMenu").hide ();
      markBorders (namepic);
    },
    //============================================================================================
    fullSize () { // ##### Show full resolution image

      $ ("#link_show a").css ('opacity', 0 );
      if (window.screen.width < 500) return;
      if (!(allow.imgOriginal || allow.adminAll)) return;
      var name = $ ("#picName").text ();
      // Only selected user classes may view or download protected images
      if ( (name.startsWith ("Vbm") || name.startsWith ("CPR")) && ["admin", "editall", "edit"].indexOf (loginStatus) < 0) {
        userLog (name + " COPYRIGHT©protected");
        userLog (cmsg, true, 10000); // 10 s
        return;
      }
      spinnerWait (true);
      return new Promise ( (resolve, reject) => {
        var xhr = new XMLHttpRequest ();
        var origpic = $ (".img_show img:first").attr ("title"); // With path
        origpic = $ ("#imdbLink").text () + "/" + origpic;
        xhr.open ('GET', 'fullsize/' + origpic, true, null, null); // URL matches routes.js with *?
        xhr.onload = function () {
          if (this.status >= 200 && this.status < 300) {

            // NOTE: djvuName is the name of a PNG file, starting from 2019, see routes.js
            var djvuName = xhr.responseText;
            //var dejavu = window.open (djvuName  + '?djvuopts&amp;zoom=100', 'dejavu', 'width=916,height=600,resizable=yes,location=no,titlebar=no,toolbar=no,menubar=no,scrollbars=yes,status=no'); // Use the PNG file instead (wrongly named):
            var dejavu = window.open (djvuName, 'dejavu', 'width=916,height=600,resizable=yes,location=no,titlebar=no,toolbar=no,menubar=no,scrollbars=yes,status=no');
            if (dejavu) {dejavu.focus ();} else {
              userLog ("POPUP blocked by browser", true, 5000); // 5 s
            }
            spinnerWait (false);
            resolve (true);
          } else {
            reject ({
              status: this.status,
              statusText: xhr.statusText
            });
          }
        };
        xhr.onerror = function () {
          reject ({
            status: this.status,
            statusText: xhr.statusText
          });
        };
        xhr.send ();
      }).catch (error => {
        console.error (error.message);
      });
    },
    //============================================================================================
    visitStat () { // ##### Show web visit statistics

      fileWR ("/usr/lib/cgi-bin/awstats.pl").then (acc => {
        if (acc) {
          execute ("/usr/lib/cgi-bin/awstats.pl -config=mish.hopto.org -output > /var/www/mish/public/awstats/index.html").then ( () => {
            var statwind = window.open ('/awstats', 'statwind');
            if (statwind) {statwind.focus ();} else {
              userLog ("POPUP blocked by browser", true, 5000);
            }
          });
        } else {
          //console.log ("NO AWSTATS");
          var title = "Information";
          var text = "<br>Här saknas<br>besöksstatistik"; // i18n
          var yes = "Ok" // i18n
          infoDia (null, null, title, text, yes, true);
        }
      });

    },
    //============================================================================================
    downLoad () { // ##### Download an image

      if (!(allow.imgOriginal || allow.adminAll)) return;
      let name = $ ("#picName").text ();
      // Only selected user classes may view or download protected images
      if ( (name.startsWith ("Vbm") || name.startsWith ("CPR")) && ["admin", "editall", "edit"].indexOf (loginStatus) < 0) {
        userLog ("COPYRIGHT©protected", true);
        later ( ( () => {
          userLog (cmsg, true, 10000); // 10 s
        }), 2000);
        return;
      }
      $ ("#link_show a").css ('opacity', 0 );
      spinnerWait (true);
      return new Promise ( (resolve, reject) => {
        var xhr = new XMLHttpRequest ();
        var tmp = $ ("#picName").text ().trim ();
        later ( ( () => {
          resetBorders (); // Reset all borders
          markBorders (tmp); // Mark this one
        }), 50);
        var origpic = $ ('#i' + escapeDots (tmp) + ' img.left-click').attr ("title"); // With path
        origpic = $ ("#imdbLink").text () + "/" + origpic;
        xhr.open ('GET', 'download/' + origpic, true, null, null); // URL matches routes.js with *?
        xhr.onload = function () {
          if (this.status >= 200 && this.status < 300) {
            //console.log (this.responseURL); // Contains http://<host>/download/...
            var host = this.responseURL.replace (/download.+$/, "");
            $ ("#download").attr ("href", host + this.responseText); // Is just 'origpic'(!)
            later ( ( () => {
              //$ ("#download").click (); //DOES NOT WORK
              document.getElementById ("download").click (); // Works
            }), 250);
            spinnerWait (false);
            userLog ("DOWNLOAD");
            resolve (true);
          } else {
            reject ({
              status: this.status,
              statusText: xhr.statusText
            });
          }
        };
        xhr.onerror = function () {
          reject ({
            status: this.status,
            statusText: xhr.statusText
          });
        };
        xhr.send ();
      }).catch (error => {
        console.error (error.message);
      });
    },
    //============================================================================================
    toggleMark (name) { // ##### Mark an image

      $ ("div.ui-tooltip-content").remove (); // May remain unintentionally ...
      if (!name) {
        name = document.getElementById ("link_show").nextElementSibling.nextElementSibling.textContent.trim ();
      }
      $ ("#picName").text (name);
      resetBorders (); // Reset all borders
      var ident = "#i" + escapeDots (name) + " div:first";
      var marked = $ (ident).hasClass ("markTrue");
      $ (ident).removeClass ();
      $ ("#markShow").removeClass ();
      if (marked) {
        $ (ident).addClass ('markFalse');
        $ ("#markShow").addClass ('markFalseShow');
      } else {
        $ (ident).addClass ('markTrue');
        $ ("#markShow").addClass ('markTrueShow');
      }
      $ ('.showCount .numMarked').text ($ (".markTrue").length + " ");
    },
    //============================================================================================
    logIn () { // ##### User login/confirm/logout button pressed

      var usr = "", status = "";
      $ ("#title span.eraseCheck").css ("display", "none");
      $ ("div[aria-describedby='textareas']").css ("display", "none");
      //$ ("#dialog").dialog ("close");
      $ ("#searcharea").dialog ("close");
      document.getElementById ("divDropbox").className = "hide-all";
      ediTextClosed ();
      var that = this;
      $ (".img_show").hide ();
      $ (".nav_links").hide ();
      var btnTxt = $ ("#title button.cred").text ();
      $ ("#title span.cred.status").show ();

      //¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤
      if (btnTxt === "Logga in") { // Log in (should be buttonText[0] ... i18n)
        $ ("#title input.cred").show ();
        //$ ("#title input.cred.user").focus ();
        //$ ("#title input.cred.user").select ();
        $ ("#title button.cred").text ("Bekräfta");
        $ ("#title button.cred").attr ("title", "Bekräfta inloggning");
        later ( ( () => {
          $ ("#title input.cred").blur ();
          //$ ("#title button.cred").focus (); // Prevents FF showing link to saved passwords
          $ ("#title a.proid").focus (); // Prevents FF showing link to saved passwords
        }),100);
        //spinnerWait (false);
        return;
      }
      //¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤
      if (btnTxt === "Logga ut") { // Log out
        //this.actions.imageList (false);
//==        spinnerWait (true);
        $ ("#hideFlag").text ("1");// Two lines from 'toggleHideFlagged'
        this.actions.hideFlagged (true).then (null); // Hide flagged pics if shown
        $ ("#title button.cred").text ("Logga in");
        $ ("#title button.cred").attr ("title", logAdv);
        $ ("#title button.cred").attr ("totip", logAdv);
        $ ("#title span.cred.name").text ("");
        $ ("#title span.cred.status").text ("");
        $ ("#title span.cred.status").hide ();
        this.set ("loggedIn", false);
        $ ("div.settings, div.settings div.check").hide ();
        //$ ("#title button.viewSettings").hide ();
        userLog ("LOGOUT");
        //$ ("#title a.finish").focus ();
        $ ("#title a.proid").focus ();
        zeroSet (); // #allowValue = '000... etc.
        this.actions.setAllow ();
        $ (".mainMenu p:eq(3) a").hide (); // Hide the album-edit button in mainMenu
        $ ("#showDropbox").hide ();  // Hide upload button

        if ($ ("#imdbRoot").text ()) { // If imdb is initiated
          // Regenerate the picFound album: the shell commands must execute in sequence
          let lpath = $ ("#imdbLink").text () + "/" + $ ("#picFound").text ();
          execute ("rm -rf " +lpath+ " && mkdir " +lpath+ " && touch " +lpath+ "/.imdb").then ();
        }
        // Inform about login/logout i18n
        let text = "Du kan fortsätta att se på bilder utan att logga in, ";
        text += "men med <b style='font-family:monospace'>gästinloggning</b>* kan du:<br><br>";
        text += '<div style="text-align:left">'
        text += "1. Tillfälligt gömma vissa bilder (bra att ha om du vill visa en ";
        text += "bildserie men hoppa över en del)<br>";
        text += "2. Byta ordningsföljden mellan bilderna (dra/släpp; bra att ha ";
        text += "om du vill visa en viss följd av bilder)<br>";
        text += "3. Se bilder i större förstoring (förbehåll för vissa bilder där ";
        text += "vi inte har tillstånd av copyright-innehavaren)<br><br>";

        text += "Logga in som *<b style='font-family:monospace'>gäst</b> genom att ";
        text += "(1) klicka på <b style='font-family:monospace'>Logga in</b>, (2) skriva <b style='font-family:monospace'>gäst</b> (eller <b style='font-family:monospace'>guest</b>) i <b style='font-family:monospace'>User name</b>-fältet ";
        text += "(ta bort om där står något annat) och (3) klicka på <b style='font-family:monospace'>Bekräfta</b> (inget Password!). ";
        text += "Du är nu användaren <b style='font-family:monospace'>gäst</b> med <b style='font-family:monospace'>guest</b>-rättigheter – andra användare ";
        text += "måste logga in med lösenord (password) och kan ha andra rättigheter ";
        text += "utöver 1. 2. 3. ovan.<br><br>";
        text += "</div>"

        text += "Om du misslyckas med inloggningen (alltså gör fel, visas ej här!) blir ";
        text += "du inloggad som <b style='font-family:monospace'>anonym</b> som är likvärdigt med att vara utloggad. ";
        text += "Börja om med att logga ut och så vidare.";
        $ ("iframe").hide ();
        $ (".mainMenu").hide ();
        infoDia ("", "", '<b style="background:transparent">ÄR DU UTLOGGAD?</b>', text, "Jag förstår!", false, false);
        //(dialogId, picName, title, text, yes, modal, flag)";
        later ( ( () => { // Do not hide the top logon line:
          $ ("#dialog").parent ().css ("top", "38px");
        }), 200);
        document.getElementById ("t3").parentElement.style.display = "none";

        // Assure that the album tree is properly shown after LOGOUT
        this.set ("albumData", []); // Triggers jstree rebuild in requestDirs
        setTimeout (function () { // NOTE: Normally, later replaces setTimeout
          $ ("#requestDirs").click ();
          later ( ( () => {
            $ (".ember-view.jstree").jstree ("deselect_all");
            $ (".ember-view.jstree").jstree ("close_all");
            $ (".ember-view.jstree").jstree ("open_node", "#j1_1");
            $ (".ember-view.jstree").jstree ("select_node", "#j1_1");
            // Next line is a BUG SAVER only. In some way, an initial hide is generated, WHERE?
            //if (this.actions) this.actions.imageList (true);
            // Side effect (minor): Deactivation of the "active album" link in the main menu
            // (next to last entry), but it will be reset as soon as the jstree is revisited.
            //$ (".ember-view.jstree").jstree ("select_node", $ ("#j1_1"));
            /*later ( ( () => {
              $ ("#j1_1_anchor").click ();
            }), 2000);*/
          }), 2000);
        }, 2000);                 // NOTE: Preserved here just as an example
//==        spinnerWait (false);
        return;
      }
      //¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤
      if (btnTxt === "Bekräfta") { // Confirm
//==        spinnerWait (true);
        //this.actions.imageList (false);
        usr = $ ("#title input.cred.user").val ();
        var pwd = $ ("#title input.cred.password").val ().trim (); // Important
        $ ("#title input.cred.password").val ("");
        $ ("#title input.cred").hide ();
        this.set ("albumData", []); // Triggers jstree rebuild in requestDirs
        this.set ("loggedIn", false);
        zeroSet (); // #allowValue = '000... etc.
        this.actions.setAllow ();


        var albFind;
        var picFind;



        loginError ().then (isLoginError => {
          if (isLoginError) {
            // Update aug 2017: will not happen
            $ ("#title button.cred").text ("Logga in");
            $ ("#title button.cred").attr ("title", logAdv);
            $ ("#title button.cred").attr ("totip", logAdv);
            this.set ("loggedIn", false);
            $ ("div.settings, div.settings div.check").hide ();
            userLog ("LOGIN error");
            this.actions.setAllow ();
            //later ( ( () => {
              //console.log ("Err, allowValue", $ ("#allowValue").text ());
            //}), 200);
          } else {
            if (usr !== "anonym") {$ ("#dialog").dialog ("close");}
            $ ("#title button.cred").text ("Logga ut");
            //$ ("#title button.cred").attr ("title", "Du är inloggad ..."); // more below
            this.set ("loggedIn", true);
            status = $ ("#title span.cred.status").text (); // [<status>]
            userLog ("LOGIN " + usr + " " + status);
            status = status.slice(1,status.length-1); // <status>
            this.actions.setAllow ();

            // NOTE: The server sets an albFind|picFind short time cookie when trig-
            // gered from the browser by .../album/<albumdir>/[<album>[/<picname>]]
            // (<album> is found in the present album root directory <albumdir>)
            // or .../find/<albumdir>[/<picname(s)>]. Sets IMDB_ROOT = <albumdir>.
            var albFindCoo = getCookie ("album");
            var picFindCoo = getCookie ("find");
//console.log("albFindCoo",albFindCoo);
//console.log("picFindCoo",picFindCoo);
            let tmpRoot = $ ("#imdbRoot").text ();
            if (albFindCoo) tmpRoot = albFindCoo.split ("/") [0];
            if (picFindCoo) tmpRoot = picFindCoo.split ("/") [0];
            $ ("#imdbRoot").text (tmpRoot);
            this.set ("imdbRoot", tmpRoot);
            if (tmpRoot) {
              this.actions.selectRoot (tmpRoot, this);
              this.set ("albumData", []); // Triggers jstree rebuild in requestDirs
              $ ("#requestDirs").click ();
              // Regenerate the picFound album: the shell commands must execute in sequence
              let lpath = $ ("#imdbLink").text () + "/" + $ ("#picFound").text ();
              execute ("rm -rf " +lpath+ " && mkdir " +lpath+ " && touch " +lpath+ "/.imdb").then ();
              // Remove all too old picFound album catalogs:
              let lnk = this.get ("imdbLink"); // NOTE: Remember the added random <.01yz>
              let toold = 60; // minutes. NOTE: Also defined in routes.js, please MAKE COMMON!!
              execute ('find -L ' + lnk + ' -type d -name "' + picFound + '*" -amin +' + toold + ' | xargs rm -rf').then ();
              userLog ("START " + $ ("#imdbRoot").text ());
              later ( ( () => {

                // The getCookie result is used here, detects external "/album/..."
                // and external "/find/...", but NOTE: Only one of them, never both
                if (albFindCoo) albFind = albFindCoo.split ("/");
                else albFind = ["", "", ""];
                if ($ ("#imdbRoots").text ().split ("\n").indexOf (albFind [0]) < 1) albFind = ["", "", ""];
                /*else {
                  if ($ ("#imdbRoot").text () !== albFind [0]) { // Change album root
                    this.actions.selectRoot (albFind [0], this);
                  }
                }*/
                if (picFindCoo) picFind = picFindCoo.split ("/");
                else picFind = ["", ""];
        //console.log(picFind);
        //console.log($ ("#imdbRoots").text ());
                if ($ ("#imdbRoots").text ().split ("\n").indexOf (picFind [0]) < 1) picFind = ["", ""];
                /*else {
                  if ($ ("#imdbRoot").text () !== picFind [0]) { // Change album root
                    this.actions.selectRoot (picFind [0], this);
                  }
                }*/




                //$ ("#requestDirs").click ();
                later ( ( () => {
                  $ (".ember-view.jstree").jstree ("deselect_all");
                  $ (".ember-view.jstree").jstree ("close_all");
                  $ (".ember-view.jstree").jstree ("open_node", "#j1_1");
                  $ (".ember-view.jstree").jstree ("select_node", "#j1_1");
                  startInfoPage ()
//==                  spinnerWait (false);
                }), 1000);
              }), 500);
              // Next lines are a 'BUG SAVER'. Else, is all not initiated...?
              // And the delay appears to be important, 2000 is too little.
              later ( ( () => {
                $ ("#j1_1_anchor").click ();
              }), 6000);
            }
            $ ("#title a.proid").focus ();
          }
//==          spinnerWait (false);
        });
        $ (document).tooltip ("enable");

        later ( () => {
          //console.log (usr, "status is", status);
          // At this point, we are always logged in with at least 'viewer' status
          if (!(allow.notesView || allow.adminAll)) {
            document.getElementById ("t3").parentElement.style.display = "none";
          } else {
            document.getElementById ("t3").parentElement.style.display = "";
          }
          // Hide or show the album-edit button in mainMenu
          if (!(allow.albumEdit || allow.adminAll)) $ (".mainMenu p:eq(3) a").hide ()
          else $ (".mainMenu p:eq(3) a").show ();
          // Hide or show the web traffic statistics button
          if (allow.deleteImg || allow.adminAll) $ ("#viSt").show ()
          else $ ("#viSt").hide ();

          later ( () => {
//console.log("albFind",albFind);
if (albFind) {
            if (albFind [0] && status !== "viewer") {
              later ( () => {
                console.log ("/album/:", albFind [0], albFind [1]);
                later ( () => {
                  $ ("#imdbDir").text ("");
                  this.actions.subaSelect (albFind [1]);
                }, 4000);
                later ( () => {
                  if (albFind [2]) {
                    later ( () => {
                      let idimg = "#i" + escapeDots (albFind [2]);
                      $ (idimg + " img") [0].click ();
//console.log(idimg + " img");
                    }, 8000);
                  } // end if
                }, 4000);
              }, 2000);
            } // end if
}
//console.log("picFind",picFind);
if (picFind) {
//console.log("*"+picFind [1]+"*");
            if (picFind [0] && status !== "viewer") {
              later ( () => {
                console.log ("/find/:", picFind [0], picFind [1]);
                this.actions.findText ();
                /*let boxes = $ ('.srchIn input[type="checkbox"]');
                for (let i=0; i<boxes.length; i++) {
                  if (i === boxes.length - 1) boxes [i].checked = true;
                  else boxes [i].checked = false;
                } USING changed DEFAULT INSTEAD*/
                if (picFind [1]) {
                  document.querySelector ('.orAnd input[type="radio"]').checked = false;
                  document.querySelectorAll ('.orAnd input[type="radio"]') [1].checked = true;
                  $ ("#searcharea textarea").val (picFind [1]);
                  later ( () => {
                    $ ("button.findText").click ();
                    later ( () => {
                      parentAlbum ();
                      later ( () => {
                        let idimg = "#i" + escapeDots (picFind [1]);
                        $ (idimg + " img") [0].click ();
//console.log(idimg + " img");
                      }, 8000);
                    }, 6000);
                  }, 4000);
                } // end if
              }, 2000);
            } // end if
}
spinnerWait (false);
//console.log("¤end¤",$ ("#imdbRoots").text ());
//console.log("¤end¤¤",$ ("#imdbRoot").text ());

          }, 2000);
        }, 2000);
      } // end Confirm
      //¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤¤
      // When password doesn't match user, return true; [else set 'allowvalue' and return false]
      // NOTE: Update aug 2017: else set anonymous viewer with no credentials, still return true
      function loginError () {
        return new Promise (resolve => {
          getCredentials (usr).then (credentials => {
            var cred = credentials.split ("\n");
            var password = cred [0];
            status = cred [1];
            var allval = cred [2];
            if (pwd !== password) {
              zeroSet (); // Important!
              allval = $ ("#allowValue").text ();
              status = "viewer";
            }
            loginStatus = status; // global
            if (status === "viewer") {usr = "anonym";}  // i18n
            //spinnerWait (true);
            $ ("#allowValue").text (allval);
            $ ("#title span.cred.name").html ("<b>"+ usr +"</b>");
            $ ("#title span.cred.status").html ("["+ status +"]");
            let tmp = "Du är inloggad som ’" + usr + "’ med [" + status + "]-rättigheter"; // i18n
            let tmp1 = " (För medverkande: Logga ut före ny inloggning)";
            $ ("#title button.cred").attr ("title", tmp + tmp1);
            $ (".cred.name").attr ("title", tmp);
            $ (".cred.status").attr ("title", "Se dina rättigheter");
            $ ("#title button.cred").attr ("totip", tmp + tmp1);
            $ (".cred.name").attr ("totip", tmp);
            $ (".cred.status").attr ("totip", "Se dina rättigheter");
            // Assure that the album tree is properly shown
            that.set ("albumData", []); // Triggers jstree rebuild in requestDirs
            that.actions.setAllow ();
            later ( ( () => {
              $ ("#requestDirs").click ();
              setTimeout (function () { // NOTE: Normally, later replaces setTimeout
                $ (".ember-view.jstree").jstree ("deselect_all");
                $ (".ember-view.jstree").jstree ("close_all");
                $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
                later ( ( () => {
                  $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_1"));
                  // Show the unchecked erase-link&&source checkbox if relevant
                  eraseOriginals = false;
                  if ( (allow.deleteImg || allow.adminAll) && ["admin", "editall"].indexOf (loginStatus) > -1) {
                    $ ("#title span.eraseCheck").css ("display", "inline");
                    $ ("#eraOrig") [0].checked = false;
                  } else {
                    $ ("#title span.eraseCheck").css ("display", "none");
                    $ ("#eraOrig") [0].checked = false;
                  }
                }), 2000);
                resolve (false);
              }, 2000);                 // NOTE: Preserved here just as an example
            }), 200);

            // Hide upload button if just viewer or guest:
            if (status === "viewer" || status === "guest") {
              $ ("#showDropbox").hide ();
            } else {
              $ ("#showDropbox").show ();
            }
            // Next line is a BUG SAVER only. In some way, an initial hide is generated, WHERE?
            /*later ( ( () => {
              $ ("#j1_1_anchor").click ();
            }), 2000);*/
          }).catch (error => {
            console.error (error.message);
          });

          function getCredentials (user) { // Sets .. and returns ...
            return new Promise ( (resolve, reject) => {
              // ===== XMLHttpRequest checking 'usr'
              var xhr = new XMLHttpRequest ();
              xhr.open ('GET', 'login/' + user, true, null, null);
              xhr.onload = function () {
                resolve (xhr.responseText);
              }
              xhr.onerror = function () {
                reject ({
                  status: that.status,
                  statusText: xhr.statusText
                });
              }
              xhr.send ();
            }).catch (error => {
              console.error (error.message);
            });
          }
        });
      }
    },
    //============================================================================================
    toggleSettings () { // ##### Show/change settings

      $ ("div.ui-tooltip-content").remove (); // May remain unintentionally ...
      if (!this.get ("loggedIn") || $ ("div.settings").is (":visible")) {
        $ ("div.settings, div.settings div.check").hide ();
        return;
      }
      $ ("div.settings, div.settings div.check").show ();
//==      spinnerWait (false);
      $ ("#dialog").dialog ("close");
      $ ("#searcharea").dialog ("close");
      ediTextClosed ();
      document.getElementById ("divDropbox").className = "hide-all";
      $ (".img_show").hide (); // settings + img_show don't go together
      $ (".nav_links").hide ();
      this.actions.setAllow (); // Resets unconfirmed changes
      document.querySelector ('div.settings button.confirm').disabled = true;
      var n = document.querySelectorAll ('input[name="setAllow"]').length;
      for (var i=0; i<n; i++) {
        document.querySelectorAll ('input[name="setAllow"]') [i].disabled = false;
        document.querySelectorAll ('input[name="setAllow"]') [i].addEventListener ('change', function () {
          document.querySelector ('div.settings button.confirm').disabled = false;
        })
      }
      // Protect the first checkbox (must be 'allow.adminAll'), set in the sqLite tables:
      document.querySelectorAll ('input[name="setAllow"]') [0].disabled = true;
      // Lock if change of setting is not allowed
      if (!(allow.setSetting || allow.adminAll)) {
        disableSettings ();
        $ (".settings input[type=checkbox]+label").css ("cursor", "default");
      }
      if ($ ("div.settings").is (":visible")) {
        $ (".mainMenu").hide ();
      }
    },
    //============================================================================================
    webLinker () {
      if ($ ("div[aria-describedby='dialog']").is (":visible")) {
        $ ("#dialog").dialog ("close");
        return;
      }
      $ ("iframe").hide ();
      let linktext = window.location.hostname
      if (linktext === "localhost") {
        linktext = "http://localhost:3000";
      } else {
        linktext = "https://" + linktext;
      }
      linktext += "/find/" + $ ("#imdbRoot").text () + "/";
      /*let names = $ (".img_mini .img_name").text ();
      names = names.toString ().trim ().replace (/\s+/g, " ");
      names = names.split (" ");
      let tmp = document.getElementsByClassName ("img_mini");
      let numTotal = tmp.length;
      let linkarr = [];
      for (let i=0; i<numTotal; i++) {
        if (tmp [i].style.backgroundColor !== $ ("#hideColor").text ()) {
          if ($ ("#imdbDir").text () === $ ("#imdbLink").text () + "/" + $ ("#picFound").text ()) {
            names [i] = names [i].replace (/\.[^.]{4}$/, "");
          }
          //linktext += names [i] + "%20";
          linkarr.push (names [i]);
        }
      }*/
      let pixt = "bilden"; // i18n
      //if (linkarr.length > 1) pixt = "bilderna";
      //linktext += linkarr.join ("%20");
      //console.log(linktext);
      //let lite = "<br>Just nu visas inga albumbilder";
      let name = $ ("#picName").text (); // Link to a single picture
      if ($ ("#imdbDir").text () === $ ("#imdbLink").text () + "/" + $ ("#picFound").text ()) {
        name = name.replace (/\.[^.]{4}$/, "");
      }
      linktext += name;
      let lite = "<br>Välj först en albumbild!";
      if (linktext.replace (/^([^/]*\/)*(.*)/, "$2")) {
        lite = "Webblänk till " + pixt + ":<br><br>";
        lite += '<div style="text-align:left;word-break:break-all">';
        lite += '<a href="' + linktext + '" target="_blank" draggable="false">';
        lite += '<b style="font-size:90%">' + linktext + "</b></a><br><br>";
        lite += '</div><div style="text-align:left">';
        lite += "Kopiera länktexten – den kan användas som ”klicklänk” i mejl "
        lite += "eller i en webbläsares adressfält ";
        lite += "(du kan testa med att klicka på länken)<br><br>";
        lite += "Kontrollera resultatet innan du skickar länken vidare till någon annan; ";
        lite += "om det inte blir som man tänkt sig kan det ";
        lite += "orsakas av namnlikhet, dolt album eller annat</div>";
        if (loginStatus !== "guest") {
          lite += "<br>Tänk på att vissa bilder kan kräva mer än gästinloggning för att kunna ";
          lite += "ses. Var därför gärna inloggad som ”gäst” när du gör en webblänk till andra!";
        }
      }
      infoDia (null, null, "Länk för webbläsare", lite, "OK – stäng");
    },
    //============================================================================================
    seeFavorites () {
      //console.info ("seeFavorites function called");
      if ($ ("textarea.favorites").is (":visible")) {
        $ ("#dialog").dialog ("close");
        $ (".mainMenu").hide ();
        return;
      }
      $ ("iframe").hide ();
      let favList = getCookie ("favorites").replace (/[ ]+/g, "\n");
      favDia (favList, "Lägg till markerade", "Spara", "Visa", "Stäng");
      $ (".mainMenu").hide ();
    },
    //============================================================================================
    goTop () {
      scrollTo (0, 0);
      $ (".mainMenu").hide ();
      $ ("#dialog").dialog ("close");
    }
  }
});
// G L O B A L S, that is, 'outside' (global) variables and functions (globals)
   //////////////////////////////////////////////////////////////////////////////////////
var BLINK; // setInterval return handle
var BLINK_TAG; // DOM reference for the function blink_text
// Set BLINK_TAG and start with: BLINK = setInterval (blink_text, 600);
// Cancel with clearInterval (BLINK);
var blink_text = function () {
  $(BLINK_TAG).fadeOut(350);
  $(BLINK_TAG).fadeIn(150);
}
let BACKG = "#cbcbcb";
let TEXTC = "#000";
let BLUET = "#146";
let bkgTip = "Byt bakgrund";
let cmsg = "Får inte laddas ned/förstoras utan särskilt medgivande: Vänligen kontakta copyrightinnehavaren eller Hembygdsföreningen"
let eraseOriginals = false;
let homeTip = "I N T R O D U K T I O N";
let logAdv = "Logga in för att kunna se inställningar: Anonymt utan namn och lösenord, eller med namnet ’gäst’ utan lösenord som ger vissa redigeringsrättigheter"; // i18n
let mailAdmin = "tore.ericsson@tores.se"
let nosObs = "Du får skriva men kan ej spara text utan annan inloggning"; // i18n
let nopsGif = "GIF-fil kan bara ha tillfällig text"; // i18n
let picFound = "Funna_bilder"; // i18n
let preloadShowImg = [];
let loginStatus = "";
let tempStore = "";
let chkPaths = []; // For DB picture paths to be soon updated (or removed)
let savedAlbumIndex = 0;
let returnTitles = ["Gå TILL ROT-album", "Gå MOT ROT-album", "Gå TILL SENASTE album"]; // i18n
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Cookie functions
function setCookie(cname, cvalue, exminutes) {
  if (exminutes) {
    var d = new Date();
    d.setTime(d.getTime() + (exminutes*60000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/;SameSite=Lax";
  } else {
    document.cookie = cname + "=" + cvalue + ";path=/;SameSite=Lax";
  }
  }
function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i <ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Make an array where the numbers 0, 1,... (N-1) are ordered randomly
function randIndex (N) { // improve, se w3c example
  var a = [];
  Array.from (Array(N), (e, i) => {
    a [i] = {index: i, value: Math.random()};
  });
  a = a.sort ((a,b)=>{return a.value - b.value});
  Array.from (Array (N), (e, i) => {a [i] = a [i].index})
  return a;
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
/*/ Execution pause (wait milliseconds)
function pause (ms) { // or use 'await new Promise (z => setTimeout (z, 2000))'
  console.log('pause',ms)
  return new Promise (done => setTimeout (done, ms))
}*/
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// TRUE if the current album is the search result album, with random postfix
// This album has less write restrictions etc.
let albumFindResult = () => $ ("#imdbDir").text ().replace (/^[^/]*\//, "") === $ ("#picFound").text ();
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Get the 'true' album path (imdbx is the symbolic link to the actual root of albums)
function albumPath () {
  let imdbx = new RegExp($ ("#imdbLink").text ());
  return $ ("#imdbDir").text ().replace (imdbx, $ ("#imdbRoot").text ());
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Check if an album/directory name can be accepted (a copy from the server)
function acceptedDirName (name) { // Note that &ndash; is accepted:
  let acceptedName = 0 === name.replace (/[/\-–@_.a-öA-Ö0-9]+/g, "").length && name !== $ ("#imdbLink").text ();
  return acceptedName && name.slice (0,1) !== "." && !name.includes ('/.');
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Get the age of _imdb_images databases
function age_imdb_images () {
  if (allow.albumEdit || allow.adminAll) {
    let imdbx = $ ("#imdbLink").text ();
    execute ('echo $(($(date "+%s")-$(date -r ' + imdbx + '/_imdb_images.sqlite "+%s")))').then (s => {
      let d = 0, h = 0, m = 0, text = "&nbsp;";
      if (s*1) {
        d = (s - s%86400);
        s = s - d;
        d = d/86400;
        h = (s - s%3600);
        s = s - h;
        h = h/3600;
        m = (s - s%60);
        s = s - m;
        m = m/60;
        // Show approximate txt database age
        text = "Söktextålder: ";
        if (d) {text += d + " d "; s = 0; m = 0;}
        if (h) {text += h + " h "; s = 0;}
        if (m) {text += m + " m ";}
        if (s) {text += s + " s ";}
      }
      $ ("#searcharea div.diaMess div.edWarn").html (text);
    })
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Load all image paths of the current imdbRoot tree into _imdb_images.sqlite
function load_imdb_images () {
  return new Promise (resolve => {
    spinnerWait (true);
    userLog ("Det här kan ta några minuter ...", true)
    let cmd = './ld_imdb.js -e';
    execute (cmd).then ( () => {
      spinnerWait (false);
      userLog ("Image search texts updated");
      $ ("div[aria-describedby='searcharea']").show ();
      $ ("button.updText").css ("float", "right");
      $ ("button.updText").hide ();
      resolve ("Done")
    })
  })
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Hide the show image element, called by hideShow ()
function hideShow_g () {
  $ ("ul.context-menu").hide (); // if open
  $ ("#link_show a").css ('opacity', 0 );
  $ (".img_show div").blur ();
  if ($ (".img_show").is (":visible")) {
    $ (".img_show").hide ();
    $ (".nav_links").hide ();
    gotoMinipic ($ (".img_show .img_name").text ());
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Wait for server activities etc.
function spinnerWait (runWait) {
  $ ("div.ui-tooltip-content").remove (); // May remain unintentionally ...
  if (runWait) {
    $ (".spinner").show ();
    clearInterval (BLINK); // Unlock if occasionaly in use ...
    BLINK_TAG = "#menuButton";
    BLINK = setInterval (blink_text, 600);
    $ (".mainMenu").hide ();
    $ ("div.settings, div.settings div.check").hide ();
    document.getElementById("menuButton").disabled = true;
    document.getElementById("reLd").disabled = true;
    document.getElementById("saveOrder").disabled = true;
    document.getElementById ("divDropbox").className = "hide-all";
  } else { // End waiting
    $ (".spinner").hide ();
    clearInterval (BLINK);
    later ( ( () => {
      document.getElementById("menuButton").disabled = false;
      document.getElementById("reLd").disabled = false;
      document.getElementById("saveOrder").disabled = false;
      document.getElementById("showDropbox").disabled = false; // May be disabled at upload!
      document.getElementById ("imageList").className = "show-block"; // Important! But...
      $ ("#title a.proid").focus ();
    }), 100);
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function stopSpinStopSpin () {
  let timer;
  (function repeater () {
    timer = setTimeout (repeater, 1000)
    if (document.getElementById ("stopSpin").innerHTML) {
      document.getElementById ("stopSpin").innerHTML = "";
      later ( ( () => {
        clearTimeout (timer);
        spinnerWait (false);
      }), 5000);
    }
  } ());
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function startInfoPage () { // Compose the information display page
  let iWindow = document.getElementsByTagName("iframe") [0].contentWindow;
  let iImages = iWindow.document.getElementsByTagName ("img");
  let nIm = iImages.length;
  var linktext = window.location.hostname
  if (linktext === "localhost") {
    linktext = "http://localhost:3000" + "/";
  } else {
    linktext = "https://" + linktext + "/";
  }
  execute ("cat " + $ ("#imdbLink").text () + "/_imdb_intro.txt | egrep '^/'").then (result => {
    $ ("#imdbIntro").text (result);
    var intro = result.split ("\n");
    if (intro.length < 2 || intro [0].indexOf ("Command failed") === 0) {
      $ ("#imdbIntro").text ("");
      intro = [];
      console.log("Inga introbilder");
    } else {
      console.log("Introbilder: " + intro.length);
    }
    return intro;
  }).then (intro => {
    let iText = iWindow.document.querySelectorAll ("span.imtx");
    // Remove all images except the first
    for (let i=1; i<nIm; i++) {
      iImages [i].style.width = "0";
      iImages [i].style.border = "0";
      iImages [i].setAttribute ("src", "favicon.ico");
      iText [i - 1].innerHTML = "";
    }
    // Adjust to load only available images
    if (intro.length > 0) {
      if (intro.length < nIm) nIm = intro.length + 1;
      for (let i=1; i<nIm; i++) { // i=0 is the logo picture
        let im1 = i - 1;
        let iAlbum = intro [im1].replace (/^([^ ]+).*/, "$1");
        let iName = intro [im1].replace (/^[^ ]+[ ]+([^ ]+)/, "$1");
        if (iName) {
          var imgSrc = linktext + $ ("#imdbLink").text () + iAlbum + "_show_" + iName + ".png";
          let tmp = $ ("#imdbDirs").text ().split ("\n");
          let idx = tmp.indexOf (iAlbum.slice (0, iAlbum.length - 1));
          iImages [i].parentElement.setAttribute ("onclick","parent.selectJstreeNode("+idx+");parent.gotoMinipic ('" + iName + "')");
          iImages [i].parentElement.setAttribute ("title", "Gå till " + iName); // i18n
          iImages [i].parentElement.style.margin ="0";
          tmp = "I: " + removeUnderscore (iAlbum.slice (1)).replace (/\//g, " > ");
          tmp = tmp.slice (0, tmp.length - 3);
          if (tmp.length < 3) tmp = "";
          iText [im1].innerHTML = tmp;
          iText [im1].style.fontSize = "90%";
          iText [im1].style.verticalAlign = "top";
          iText [im1].style.display = "inline-block";
          iText [im1].style.width = "20em";
          iImages [i].style.width = "19em";
          iImages [i].style.margin = "0.7em 0 0 0";
          iImages [i].style.border = "1px solid gray";
          iImages [i].style.borderRadius = "4px";
        }
        iImages [i].setAttribute ("src", imgSrc);
      }
    }
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Show a symlink's 'parent' album; tgt is the symlink's green mark picture
async function parentAlbum (tgt) {
  if (!tgt) {
    await new Promise (z => setTimeout (z, 4000));
    tgt = document.getElementsByClassName ("img_mini") [0].getElementsByTagName ("img") [1];
  }
  let classes = $ (tgt).parent ("div").parent ("div").attr("class");
  let albumDir, file, tmp;
  if (classes && -1 < classes.split (" ").indexOf ("symlink")) { // ...of a symlink...
    tmp = $ (tgt).parent ("div").parent ("div").find ("img").attr ("title");
    tmp = $ ("#imdbLink").text () + "/" + tmp;
    // ...then go to the linked picture:
    getFilestat (tmp).then (result => {
      //console.log ("Link:", tmp);
      result = result.replace (/(<br>)+/g, "\n");
      result = result.replace(/<(?:.|\n)*?>/gm, ""); // Remove <tags>
      //console.log (result.split ("\n") [1]);
      file = result.split ("\n") [0].replace (/^[^/]*\/(\.\.\/)*/, $ ("#imdbLink").text () + "/");
      albumDir = file.replace (/^[^/]+(.*)\/[^/]+$/, "$1").trim ();
      let idx = $ ("#imdbDirs").text ().split ("\n").indexOf (albumDir);
      if (idx < 0) {
        infoDia (null, null, "Tyvärr ...", "<br>Albumet <b>" + albumDir.replace (/^(.*\/)+/, "") + "</b> med den här bilden kan inte visas<br>(rätt till gömda album saknas)", "Ok", true);
        return "";
      }
      spinnerWait (true);
      document.getElementById ("stopSpin").innerHTML = "";
      stopSpinStopSpin ();
      $ (".ember-view.jstree").jstree ("close_all");
      $ (".ember-view.jstree").jstree ("_open_to", "#j1_" + (1 + idx));
      $ (".ember-view.jstree").jstree ("deselect_all");
      $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_" + (1 + idx)));
      $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
      let namepic = file.replace (/^(.*\/)*(.+)\.[^.]*$/, "$2");
      return namepic;
    }).then (async (namepic) => {
      //await new Promise (z => setTimeout (z, 12000));
      if (namepic) gotoMinipic (namepic);
    });
  } // else do nothing
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Position to a minipic and highlight its border, for child window
window.gotoMinipic = function (namepic) {
  later ( ( () => {
    gotoMinipic (namepic);
  }), 4000);
  later ( ( () => {
    userLog ("KLICKA FÖR STÖRRE BILD!", true, 6000)
    //infoDia (null, null, "Information", "<br>Klicka på miniatyrbilden så visas den större!Klicka på miniatyrbilden så visas den större!<br>", "Ok", true);
  }), 6000);
}
// Position to a minipic and highlight its border, 'main' function
function gotoMinipic (namepic) {
  let hs = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  let spinner = document.querySelector("img.spinner");
  let timer;
  (function repeater () {
    timer = setTimeout (repeater, 500)
    if (spinner.style.display === "none") {
      clearTimeout (timer);
      let y, p = $ ("#i" + escapeDots (namepic));
      if (p.offset ()) {
        y = p.offset ().top + p.height ()/2 - hs/2;
      } else {
        y = 0;
      }
      let t = $ ("#highUp").offset ().top;
      if (t > y) {y = t;}
      scrollTo (null, y);
      resetBorders (); // Reset all borders
      document.getElementById ("stopSpin").innerHTML = "SPIN-END";
      markBorders (namepic); // Mark this one
    }
  } ());
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
async function deleteFiles (picNames, nels, picPaths) { // ===== Delete image(s)
  // nels = number of elements in picNames to be deleted
  let delPaths = [];
  var keep = [], isSymlink;
  for (var i=0; i<nels; i++) {
    isSymlink = $ ('#i' + escapeDots (picNames [i])).hasClass ('symlink');
    if (!(allow.deleteImg || isSymlink && allow.delcreLink || allow.adminAll)) {
      keep.push (picNames [i]);
    } else {
      var result = await deleteFile (picPaths [i])
      if (result.slice (0,3) === "DEL") {
        delPaths.push (picPaths [i]);
      } else {
        console.log (result);
      }
    }
  }
  later ( ( () => {
    userLog (delPaths.length + " DELETED")
    // Delete database entries
    if (delPaths.length > 0) {
      sqlUpdate (delPaths.join ("\n"));
    }
    if (keep.length > 0) {
      console.log ("No delete permission for " + cosp (keep, true));
      keep = cosp (keep);
      later ( ( () => {
        infoDia (null, null, "Otillåtet att radera", '<br><span  style="color:deeppink">' + keep + '</span>', "Ok", true); // i18n
      }), 100);
    }
    later ( ( () => {
      document.getElementById("reLd").disabled = false;
      $ ("#reLd").click ();
      document.getElementById("saveOrder").disabled = false;
      $ ("#saveOrder").click ();
    }), 200);
  }), 2000);
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function deleteFile (picPath) { // ===== Delete an image
  $ ("#link_show a").css ('opacity', 0 );
  return new Promise ( (resolve, reject) => {
    // ===== XMLHttpRequest deleting 'picName'
    var xhr = new XMLHttpRequest ();
    //var origpic = $ ('#i' + escapeDots (picName) + ' img.left-click').attr ("title"); // With path
    //origpic = $ ("#imdbLink").text () + "/" + origpic;
    var origpic = picPath;
    xhr.open ('GET', 'delete/' + origpic, true, null, null); // URL matches routes.js with *?
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        //console.log (xhr.responseText);
        //userLog (xhr.responseText);
        //resolve (picName);
        resolve (xhr.responseText);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
    //console.log ('Deleted: ' + picName);
  }).catch (error => {
    console.error (error.message);
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function sqlUpdate (picPaths) {
  if (!picPaths) return;
  let data = new FormData ();
  data.append ("filepaths", picPaths);
  return new Promise ( (resolve, reject) => {
    let xhr = new XMLHttpRequest ();
    xhr.open ('POST', 'sqlupdate/')
    xhr.onload = function () {
      resolve (xhr.responseText); // empty
    };
    xhr.onerror = function () {
      resolve (xhr.statusText);
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send (data);
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function infoDia (dialogId, picName, title, text, yes, modal, flag) { // ===== Information dialog
  // NOTE: if (picName ===
  //                  "name") { show info for that picture }
  //                      "") { run serverShell ("temporary_1") ... }
  //   null && flag === true) { evaluate #temporary, probably for albumEdit }
  if (!dialogId) {dialogId = "dialog";}
  var id = "#" + dialogId;
  if (picName) { //
    resetBorders (); // Reset all borders
    markBorders (picName); // Mark this one
  }
  $ (id).dialog ( { // Initiate dialog
    title: "", // html set below //#
    closeText: "×",
    autoOpen: false,
    draggable: true,
    modal: modal,
    closeOnEscape: true,
  });
  later ( ( () => {
    $ (id).html (text);
    // Define button array
    $ (id).dialog ('option', 'buttons', [
    {
      text: yes, // Okay. See below
        id: "yesBut",
      click: function () {
        if (picName === "") { // Special case: link || move || ...
          spinnerWait (true);
          serverShell ("temporary_1");

          // Extract/construct sqlUpdate file list if there are any
          // move=... moveto=... lines in #temporary_1
          // Note: Files to be moved from #picFound and have got a random
          // postfix are symlinks and thus ignored in any case by sqlUpdate
          // (Why I do say that? Since a moved symlink has no random postfix...)
          let txt = document.getElementById ("temporary_1").innerHTML.split (";");
          let files = [];
          for (let i=0; i<txt.length; i++) {
            if (txt [i].indexOf ("move") === 0) {
              files.push (txt [i].replace (/^[^=]+=/, ""));
            }
          }
//console.log(files);
          for (let i=0; i<files.length; i+= 2) {
            let name = files [i].replace (/^(.*\/)*/, "");
            files [i + 1] = files [i + 1] + name;
          }
//console.log(files);
          files = files.join ("\n");
          if (files.length > 0) {
            later ( ( () => {
              document.getElementById("reLd").disabled = false;
              $ ("#reLd").click ();
            }), 800);
//console.log("===========\n" + files);
            later ( ( () => {
              sqlUpdate (files);
            }), 5000);
          }
        }
        $ (this).dialog ("close");
        $ ('#navKeys').text ('true'); // Reset in case L/R arrows have been protected
        if (flag && !picName) { // Special case: evaluate #temporary, probably for albumEdit
          console.log ($ ("#temporary").text ());
          eval ($ ("#temporary").text ());
          return true;
        }
        // If this is the second search (result) dialog:
        if (yes.indexOf ("Visa i") > -1) {
          spinnerWait (true);
          later ( ( () => {
            document.getElementById("reLd").disabled = false;
            $ ("#reLd").click ();
          }), 800);
        }
        /* later ( ( () => {
          spinnerWait (false);
        }), 1600); */
        return true;
      }
    }]);
    $ ("div[aria-describedby='" + dialogId + "'] span.ui-dialog-title").html (title); //#
    niceDialogOpen (dialogId);
  }), 33);
  later ( ( () => {
    $ ("#yesBut").focus ();
    $ ("#yesBut").html (yes);
  }), 333);
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function favDia (text, add, save, show, close) { // ===== Show favorites dialog
  // the arguments = the favorite text list and four button texts
  $ ("#dialog").dialog ('destroy').remove ();
  let favs = "Favoritbilder"; // i18n
  $ ('<div id="dialog"><textarea class="favorites" name="favorites" placeholder="Skriv in favoriter = bildnamn som ska sparas" rows="16" cols="32"></textarea></div>').dialog ( { // Initiate dialog
    title: favs,
    closeText: "×",
    autoOpen: false,
    draggable: true,
    modal: false,
    closeOnEscape: true,
    resizable: false
  });
  // Improve 'dialog title':
  $ ("div[aria-describedby='dialog'] span.ui-dialog-title").html (" <span class='blue'>" + favs + "</span>");
  // Define button array
  $ ("#dialog").dialog ("option", "buttons", [
    {
      text: add,
      class: "addFavs",
      click: function () {
        let newfav = "";
        let nodes = document.getElementsByClassName ("markTrue");
        for (let i=0; i<nodes.length; i++) {
          let str = nodes [i].nextElementSibling.innerHTML.trim ();
          if ($ ("#imdbDir").text ().replace (/^[^/]+\//, "") === $ ("#picFound").text ()) {
            str = str.replace (/\.[^.]{4}$/, "");
          }
          newfav += str + "\n";
        }
        let text = $ ('textarea[name="favorites"]').val ().trim ();
        var texar = $ ('textarea[name="favorites"]') [0];
        //var texar = document.querySelector('textarea[name="favorites"]');
        $ ('textarea[name="favorites"]').val ( (text + "\n" + newfav).trim ());
        texar.scrollTop = texar.scrollHeight;
        texar.focus ();
      }
    },
    {
      text: save,
      class: "saveFavs",
      click: function () {
        let text = $ ('textarea[name="favorites"]').val ();
        saveFavorites (text);
        $ ('textarea[name="favorites"]').focus ();
      }
    },
    {
      text: show,
      class: "showFavs",
      click: function () {
        $ ("#searcharea").dialog ("close");
        let text = $ ('textarea[name="favorites"]').val ().trim (); // Important!
        saveFavorites (text);
        $ (this).dialog ("close");
        text = text.replace (/[ \n]+/g, " ").trim ();
        // Save this album as previous:
        savedAlbumIndex = $ ("#imdbDirs").text ().split ("\n").indexOf ($ ("#imdbDir").text ().slice ($ ("#imdbLink").text ().length));
        // Place the namelist in the picFound album still if not yet chosen
        // Preset imdbDir 'in order to cheat' saveOrderFunc
        $ ("#imdbDir").text ($ ("#imdbLink").text () +"/"+ $ ("#picFound").text ());
        // Populate the picFound album with favorites in namelist order:
        doFindText (text, false, [false, false, false, false, true], true);
      }
    },
    {
      text: close,
      class: "closeFavs",
      click: function () {
        $ (this).dialog ("close");
      }
    }
  ]);
  //$ ("#dialog").dialog ("open");
  niceDialogOpen ();
  var tmp = $ ("#dialog").prev ().html ();
  //tmp = tmp.replace (/<span([^>]*)>/, "<span$1><span>" + picName + "</span> &nbsp ");
  // Why doesn't the close button work? Had to add next line to get it function:
  tmp = tmp.replace (/<button/,'<button onclick="$(\'#dialog\').dialog(\'close\');"');
  $ ("#dialog").prev ().html (tmp);
  $ ('textarea[name="favorites"]').html ("");
  niceDialogOpen ("dialog");
  $ ('textarea[name="favorites"]').focus ();
  later ( ( () => {
    $ ('textarea[name="favorites"]').html (text);
  }), 40);
  $ ("#dialog").css ("padding", "0");
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function notesDia (picName, filePath, title, text, save, saveClose, close) { // ===== Text dialog
  $ ("#notes").dialog ('destroy').remove ();
  if (picName) { //
    resetBorders (); // Reset all minipic borders
    markBorders (picName); // Mark this one
  }
  $ ('<div id="notes"><textarea class="notes" name="notes" placeholder="Anteckningar (för Xmp.dc.source) som inte visas med bilden" rows="8"></textarea></div>').dialog ( { // Initiate dialog
    title: title,
    closeText: "×",
    autoOpen: false,
    draggable: true,
    modal: true,
    closeOnEscape: true,
    resizable: false
  });
  // Improve 'dialog title':
  $ ("div[aria-describedby='notes'] span.ui-dialog-title").html (title + " <span class='blue'>" + picName + "</span>");

  function notesSave () { // NOTE: This way to save metadata is probably the most efficient, and
    // 'xmpset' should perhaps ultimately replace 'set_xmp_creatior' and 'set_xmp_description'?
    // Remove extra spaces and convert to <br> for saving metadata in server image:
    text = $ ('textarea[name="notes"]').val ().replace (/ +/g, " ").replace (/\n /g, "<br>").replace (/\n/g, "<br>").trim ();
    fileWR (filePath).then (acc => {
      if (acc !== "WR") {
        userLog ("NOT written");
        infoDia (null, null,"Texten kan inte sparas", "<br><span class='pink'>" + picName + "</span> ändringsskyddad, försök igen<br><br>Om felet kvarstår:<br>Kontrollera filen!", "Stäng", true);
      } else {
        // Remove <br> in the text shown; use <br> as is for metadata
        $ ('textarea[name="notes"]').val (text.replace (/<br>/g, "\n"));
        // Link: filePath correct?
        execute ("xmpset source " + filePath + ' "' + text.replace (/"/g, '\\"')+ '"').then ( () => {
          userLog ("TEXT written", false, 2000);
        });
      }
    });
  }
  // Define button array
  $ ("#notes").dialog ("option", "buttons", [
    {
      text: save,
      //"id": "saveBut",
      class: "saveNotes",
      click: function () { // ***duplicate***
        notesSave ();
      }
    },
    {
      text: saveClose,
      class: "saveNotes",
      click: function () { // ***duplicate***
        notesSave ();
        $ (this).dialog ("close");
      }
    },
    {
      text: close,
      class: "closeNotes",
      click: function () {
        $ (this).dialog ("close");
      }
    }
  ]);
  //$ ("#notes").dialog ("open");
  niceDialogOpen ("notes");
  var tmp = $ ("#notes").prev ().html ();
  //tmp = tmp.replace (/<span([^>]*)>/, "<span$1><span>" + picName + "</span> &nbsp ");
  // Why doesn't the close button work? Had to add next line to get it function:
  tmp = tmp.replace (/<button/,'<button onclick="$(\'#notes\').dialog(\'close\');"');
  $ ("#notes").prev ().html (tmp);
  $ ('textarea[name="notes"]').html ("");
  niceDialogOpen ("notes");
  later ( ( () => {
    //$ ("#notes").dialog ("open"); // Reopen
    niceDialogOpen ("notes");
    $ ('textarea[name="notes"]').focus (); // Positions to top *
    if (!(allow.notesEdit || allow.adminAll)) {
      $ ('textarea[name="notes"]').attr ("disabled", true);
      $ ("button.saveNotes").attr ("disabled", true);
      $ ("button.closeNotes").focus ();
    }
    $ ('textarea[name="notes"]').html (text.replace (/<br>/g, "\n"));
  }), 40);
  // Why doesn't the 'close-outside' work? Had to add this to get it function:
  $ ('.ui-widget-overlay').bind ('click', function () {
    $ ('#notes').dialog ("close");
  });
  $ ("#notes").css ("padding", "0");
  //document.querySelector('textarea[name="notes"]').scrollTop = 0; // * Doesn't work
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function niceDialogOpen (dialogId) {
  if (!dialogId) {dialogId = "dialog";}
  var id = "#" + dialogId;
  $ (id).width ("auto");
  $ (id).parent ().height ("auto");
  $ (id).height ("auto");
  $ (id).parent ().css ("max-height", "");
  $ (id).css ("max-height","");
//if ($ (id).parent (). css ("display") === "none") $ (id).parent ().css ("top", "38px");

  $ (id).dialog ("open");
  // For jquery-ui-touch-punch, here maybe useful, may make some dialogs opened here
  // draggable on smartphones. Less useful in other cases (search for them),
  // and it does prohibit data entry in textareas
  // Well, bad idea, since it prohibits text copy with computer!
  //if (id === "#dialog") {
  //  $ (id).parent ().attr ({draggable: "true"});
  //}
  var esw = ediTextSelWidth () - 100;
  let sw = parseInt ( (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth)*0.95);
  $ (id).parent ().css ("min-width", "300px");
  $ (id).parent ().css ("max-width", sw+"px");
  //$ (id).parent ().width ("auto");
  $ (id).width ("auto");
  //$ (id).parent ().css ("top", "38px"); // added

  let tmp = $ (id).parent ().parent ().outerWidth (); // helpText??
  let pos = $ (id).parent ().position ();
  if (tmp < esw) esw = tmp;
  if (pos.left < 2 || pos.left + esw > sw/0.95 + 10) {
    var diaDivLeft = parseInt ( (sw - esw)/2) + "px";
    $ (id).parent ().css ("left", diaDivLeft);
  }
  $ (id).parent ().width (esw + "px");
  $ (id + " textarea").width ((esw - 15) + "px");
  var up = 128;
  let hs = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  $ (id).parent ().css ("max-height", hs + "px");
  $ (id).css ("max-height", hs - up + "px");
  $ (id).parent ().draggable ();
  if (pos.top < 0) $ (id).parent ().css ("top", "2px");
  // NOTE, nodes above are JQuery objects
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Close the ediText dialog and return false if it wasn't already closed, else return true
function ediTextClosed () {
  $ ("div[aria-describedby='textareas'] span.ui-dialog-title span").html ("");
  $ (".ui-dialog-buttonset button:first-child").css ("float", "none");
  $ (".ui-dialog-buttonset button.keys").css ("float", "none");
  $ (".ui-dialog-buttonset button:first-child").attr ("title", "");
  $ (".ui-dialog-buttonset button.keys").attr ("title", "");
  if ($ ("div[aria-describedby='textareas']").css ("display") === "none") {
    return true; // It is closed
  } else {
    $ ("div[aria-describedby='textareas']").hide ();
    $ ('#navKeys').text ('true');
    return false; // It wasn't closed (now it is)
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function hideFunc (picNames, nels, act) { // ===== Execute a hide request
  // nels = number of elements in picNames to be acted on, act = hideFlag
  for (var i=0; i<nels; i++) {
    var picName = picNames [i];
    var sortOrder = $ ("#sortOrder").text ();
    var k = sortOrder.indexOf (picName + ",");
    var part1 = sortOrder.substring (0, picName.length + k + 1);
    var part2 = sortOrder.slice (picName.length + k + 1);
    k = part2.indexOf (",");
    var hideFlag = ('z' + act).slice (1); // Set 1 or 0 and convert to string
    sortOrder = part1 + hideFlag + part2.slice (k); // Insert the new flag
    /*$ ("#i" + escapeDots (picName)).css ('background-color', '#222');
    $ ("#wrap_show").css ('background-color', '#222'); // *Just in case the show image is visible     $ ("#i" + escapeDots (picName)).show ();*/
    $ ("#i" + escapeDots (picName)).css ('background-color', $ ("#bkgrColor").text ());
    $ ("#wrap_show").css ('background-color', $ ("#bkgrColor").text ()); // *Just in case the show image is visible     $ ("#i" + escapeDots (picName)).show ();
    if (hideFlag === "1") { // If it's going to be hidden: arrange its CSS ('local hideFlag')
      $ ("#i" + escapeDots (picName)).css ('background-color', $ ("#hideColor").text ());
      $ ("#wrap_show").css ('background-color', $ ("#hideColor").text ()); // *Just in case -
      // The 'global hideFlag' determines whether 'hidden' pictures are hidden or not
      if ($ ("#hideFlag").text () === "1") { // If hiddens ARE hidden, hide this also
        $ ("#i" + escapeDots (picName)).hide ();
      }
    }
    $ ("#sortOrder").text (sortOrder); // Save in the DOM
  }
  //Update picture numbers:
  var tmp = document.getElementsByClassName ("img_mini");
  var numHidden = 0, numTotal = tmp.length;
  for (i=0; i<numTotal; i++) {
    if (tmp [i].style.backgroundColor === $ ("#hideColor").text ()) {
      numHidden = numHidden + 1;
    }
  }
  if ($ ("#hideFlag").text () === "1") {
    $ (".numHidden").text (numHidden);
    $ (".numShown").text (numTotal - numHidden);
  } else {
    $ (".numHidden").text ("0");
    $ (".numShown").text (numTotal);
  }
  if (numTotal) {
    $ ("span.ifZero").show ();
  } else {
    $ ("span.ifZero").hide ();
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function linkFunc (picNames) { // ===== Execute a link-these-files-to... request
  // picNames should also be saved as string in #picNames
  var albums = $ ("#imdbDirs").text ();
  albums = albums.split ("\n");
  var curr = $ ("#imdbDir").text ().match(/\/.*$/); // Remove imdbLink
  if (curr) {curr = curr.toString ();} else {curr = "";}
  var lalbum = [];
  var i;
  for (i=0; i<albums.length; i++) { // Remove current album from options
    if (albums [i] !== curr) {lalbum.push (albums [i]);}
  }
  //var rex = /^[^/]*\//;
  var codeLink = "'var lalbum=this.value;var lpath = \"\";if (this.selectedIndex === 0) {return false;}lpath = lalbum.replace (/^[^/]*(.*)/, $ (\"#imdbLink\").text () + \"$1\");console.log(\"Link to\",lpath);var picNames = $(\"#picNames\").text ().split (\"\\n\");var cmd=[];for (var i=0; i<picNames.length; i++) {var linkfrom = document.getElementById (\"i\" + picNames [i]).getElementsByTagName(\"img\")[0].getAttribute (\"title\");linkfrom = \"../\".repeat (lpath.split (\"/\").length - 1) + linkfrom;var linkto = lpath + \"/\" + picNames [i];linkto += linkfrom.match(/\\.[^.]*$/);cmd.push(\"ln -sf \"+linkfrom+\" \"+linkto);}$ (\"#temporary\").text (lpath);$ (\"#temporary_1\").text (cmd.join(\"\\n\"));$ (\"#checkNames\").click ();'";

  var r = $ ("#imdbRoot").text ();
  var codeSelect = '<select class="selectOption" onchange=' + codeLink + '>\n<option value="">Välj ett album:</option>';
  for (i=0; i<lalbum.length; i++) {
    var v = r + lalbum [i];
    codeSelect += '\n<option value ="' +v+ '">' +v+ '</option>';
  }
  codeSelect += "\n</select>"
  var title = "Länka till annat album";
  var text = cosp (picNames) +"<br>ska länkas till<br>" + codeSelect;
  var modal = true;
  infoDia (null, "", title, text, "Ok", modal); // Trigger infoDia run 'serverShell("temporary_1")'
  $ ("select.selectOption").focus ();
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function moveFunc (picNames) { // ===== Execute a move-this-file-to... request
  // When moveFunc is called, picNames should also be saved as string in #picNames
  var albums = $ ("#imdbDirs").text ();
  albums = albums.split ("\n");
  let curr = $ ("#imdbDir").text ().match(/\/.*$/); // Remove imdbLink
  let picf = $ ("#picFound").text () // Remove if possibly picFound
  if (curr) curr = curr.toString (); else curr = "";
  let malbum = [];
  for (let i=0; i<albums.length; i++) { // Remove current and find result albums from options
    if (albums [i] !== curr && albums [i].indexOf (picf) < 0) {
      malbum.push (albums [i]);
    }
  }
  // The following will move even links, where link source is corrected and with even
  // deletion of the random postfix from picture names for links moved from #picFound.
  // Beware of the algorithm with all regular expression escapes in the text put into
  // #temporary_1, a Bash text string containing in the magnitude of 1000 characters,
  // depending on actual file names, but well within the Bash line length limit.
  var codeMove = "'var malbum=this.value;var mpath=\"\";if(this.selectedIndex===0){return false;}mpath=malbum.replace (/^[^/]*(.*)/,$(\"#imdbLink\").text()+\"$1\");var lpp=mpath.split(\"/\").length-1;if (lpp > 0)lpp=\"../\".repeat(lpp);else lpp=\"./\";console.log(\"Try move to\",malbum);var picNames=$(\"#picNames\").text().split(\"\\n\");cmd=[];for (let i=0;i<picNames.length;i++){var move=$(\"#imdbLink\").text()+\"/\"+document.getElementById(\"i\"+picNames[i]).getElementsByTagName(\"img\")[0].getAttribute(\"title\");var mini=move.replace(/([^/]+)(\\.[^/.]+)$/,\"_mini_$1.png\");var show=move.replace(/([^/]+)(\\.[^/.]+)$/,\"_show_$1.png\");var moveto=mpath+\"/\";var picfound=$(\"#picFound\").text();cmd.push(\"picfound=\"+picfound+\";move=\"+move+\";mini=\"+mini+\";show=\"+show+\";orgmove=$move;orgmini=$mini;orgshow=$show;moveto=\"+moveto+\";lpp=\"+lpp+\";lnksave=$(readlink -n $move);if [ $lnksave ];then move=$(echo $move|sed -e \\\"s/\\\\(.*$picfound.*\\\\)\\\\.[^.\\\\/]\\\\+\\\\(\\\\.[^.\\\\/]\\\\+$\\\\)/\\\\1\\\\2/\\\");mini=$(echo $mini|sed -e \\\"s/\\\\(.*$picfound.*\\\\)\\\\.[^.\\\\/]\\\\+\\\\(\\\\.[^.\\\\/]\\\\+$\\\\)/\\\\1\\\\2/\\\");show=$(echo $show|sed -e \\\"s/\\\\(.*$picfound.*\\\\)\\\\.[^.\\\\/]\\\\+\\\\(\\\\.[^.\\\\/]\\\\+$\\\\)/\\\\1\\\\2/\\\");lnkfrom=$(echo $lnksave|sed -e \\\"s/^\\\\(\\\\.\\\\{1,2\\\\}\\\\/\\\\)*//\\\" -e \\\"s,^,$lpp,\\\");lnkmini=$(echo $lnkfrom|sed -e \\\"s/\\\\([^/]\\\\+\\\\)\\\\(\\\\.[^/.]\\\\+\\\\)\\\\$/_mini_\\\\1\\\\.png/\\\");lnkshow=$(echo $lnkfrom|sed -e \\\"s/\\\\([^/]\\\\+\\\\)\\\\(\\\\.[^/.]\\\\+\\\\)\\\\$/_show_\\\\1\\\\.png/\\\");ln -sfn $lnkfrom $move;fi;mv -n $move $moveto;if [ $? -ne 0 ];then if [ $move != $orgmove ];then rm $move;fi;exit;else if [ $lnksave ];then ln -sfn $lnkmini $mini;ln -sfn $lnkshow $show;fi;mv -n $mini $show $moveto;if [ $move != $orgmove ];then rm $orgmove;fi;if [ $mini != $orgmini ];then rm $orgmini;fi;if [ $show != $orgshow ];then rm $orgshow;fi;fi;\");}$(\"#temporary\").text(mpath);$(\"#temporary_1\").text (cmd.join(\"\\n\"));'"
  // A log ...\");console.log(move,mini,show,moveto);}$...
  // may be inserted and is printed even at failure (now removed).
  // Here checkNames cannot be called (like in linkFunc) since  #temporary_1 is not usable

  //console.log("codeMove",codeMove);
  let r = $ ("#imdbRoot").text ();
  let codeSelect = '<select class="selectOption" onchange=' + codeMove + '><option value="">Välj ett album:</option>';
  //console.log(codeSelect);
  for (let i=0; i<malbum.length; i++) {
    let v = r + malbum [i];
    codeSelect += '<option value ="' +v+ '">' +v+ '</option>';
  }
  codeSelect += "</select>"
  //console.log("codeSelect",codeSelect);
  let title = "Flytta till annat album";
  let text = cosp (picNames) +"<br>ska flyttas till<br>" + codeSelect;
  let modal = true;
  infoDia (null, "", title, text, "Ok", modal); // Trigger infoDia run serverShell ("temporary_1")
  $ ("select.selectOption").focus ();
  /*later ( ( () => { // only after moveFunc (not after linkFunc!)
    document.getElementById("reLd").disabled = false;
    $ ("#reLd").click ();
  }), 3800******/
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
const saveOrderFunc = namelist => { // ===== XMLHttpRequest saving the thumbnail order list
  if (!(allow.saveChanges || allow.adminAll || albumFindResult ()) || $ ("#imdbDir").text () === "") Promise.resolve (true);
  document.getElementById ("divDropbox").className = "hide-all"; // If shown...
  return new Promise ( (resolve, reject) => {
    $ ("#sortOrder").text (namelist); // Save in the DOM
    // If, at login, the IMDB_DIR isn't yet reloaded, it should become = imdbLink:
    if (!$ ("#imdbDir").text ()) $ ("#imdbDir").text ($ ("#imdbLink").text ());
    var IMDB_DIR =  $ ('#imdbDir').text ();
    if (IMDB_DIR.slice (-1) !== "/") {IMDB_DIR = IMDB_DIR + "/";}
    IMDB_DIR = IMDB_DIR.replace (/\//g, "@"); // For sub-directories
    var xhr = new XMLHttpRequest ();
    xhr.open ('POST', 'saveorder/' + IMDB_DIR); // URL matches server-side routes.js
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        userLog ("SAVE", false, 1000);
        resolve (true); // Can we forget 'resolve'?
      } else {
        userLog ("SAVE error", false, 5000);
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.send (namelist);
  }).catch (error => {
    console.error (error.message);
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function saveFavorites (favList) {
  favList = favList.trim ();
  let txt = "\nString_too_long,_thruncated\n";
  if (favList.length > 4000) favList = (txt + favList.slice (0, 4000)).trim () + txt;
  setCookie ("favorites", favList.replace (/\n/g, " "), 0);
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function userLog (message, flashOnly, mstime) { // ===== Message to the log file and flash the user
  if (!flashOnly) {
    console.log (message);
    /*var messes = $ ("#title span.usrlg").text ().trim ().split ("•");
    if (messes.length === 1 && messes [0].length < 1) {messes = [];}
    if (!(messes.length > 0 && messes [messes.length - 1].trim () === message.trim ())) {messes.push (message);}
    if (messes.length > 5) {messes.splice (0, messes.length -5);}
    messes = messes.join (" • ");*/
    // discontinued: $ ("#title span.usrlg").text (messes);
  }
  /*let t =2000;
  if (mstime) {
    if (mstime > t) {t = mstime;}
  }*/
  //if (!mstime) mstime = 2000;
  if (mstime) {
    $ (".shortMessage").text (message);
    $ (".shortMessage").show ();
    later ( ( () => {
      $ (".shortMessage").hide ();
    }), mstime);
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function reqRoot () { // Propose root directory (requestDirs)
  return new Promise ( (resolve, reject) => {
    var xhr = new XMLHttpRequest ();
    xhr.open ('GET', 'rootdir/', true, null, null);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        var dirList = xhr.responseText;
        resolve (dirList);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
  }).catch (error => {
    if (error.status !== 404) {
      console.error (error.message);
    } else {
      console.warn ("reqRoot: No NodeJS server");
    }
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function reqDirs (imdbroot) { // Read the dirs in imdbLink (requestDirs)
  if (imdbroot === undefined) return;
//console.log(imdbroot);
  spinnerWait (true);
  document.getElementById ("stopSpin").innerHTML = "";
  stopSpinStopSpin ();
  return new Promise ( (resolve, reject) => {
    var xhr = new XMLHttpRequest ();
    // Here also #picFound is sent to the server for information/update
    xhr.open ('GET', 'imdbdirs/' + imdbroot + "@" + $ ("#picFound").text (), true, null, null);
    xhr.onload = function () {
      //spinnerWait (false);
      if (this.status >= 200 && this.status < 300) {
        var dirList = xhr.responseText;
//console.log(dirList);
        dirList = dirList.split ("\n");
        var dim = (dirList.length - 2)/3;
        var dirLabel = dirList.splice (2 + 2*dim, dim);
//console.log(dirLabel);
        var dirCoco = dirList.splice (2 + dim, dim);
        $ ("#userDir").text (dirList [0].slice (0, dirList [0].indexOf ("@")));
        $ ("#imdbRoot").text (dirList [0].slice (dirList [0].indexOf ("@") + 1));
        $ ("#imdbLink").text (dirList [1]);
        var imdbLen = dirList [1].length;
        dirList = dirList.slice (1);
        var nodeVersion = dirList [dirList.length - 1];
        var nodeText = $ (".lastRow").html (); // In application.hbs
        nodeText = nodeText.replace (/NodeJS[^•]*•/, nodeVersion +" •");
        $ (".lastRow").html (nodeText); // In application.hbs
        // Remove the last line
        dirList.splice (dirList.length - 1, 1);
        // Remove ...???
        for (let i=0; i<dirList.length; i++) {
          dirList [i] = dirList [i].slice (imdbLen);
        }
        let newList = [], newCoco = [], newLabel = [];
        // The length of "." + the random postfix is 5:
        let test = $ ("#picFound").text ();
        test = test.slice (0, test.length - 5);
        for (let i=0; i<dirList.length; i++) {
          if (dirList [i].slice (1, test.length+1) !== test || dirList [i].slice (1) === $ ("#picFound").text ()) {
            newList.push (dirList [i])
            newCoco.push (dirCoco [i])
            newLabel.push (dirLabel [i])
          }
        }
        dirList = newList;
        dirCoco = newCoco;
        dirLabel = newLabel;

        // Remove "ignore" albums from the list if not allowed, starred in dirCoco
        if (!(allow.textEdit || allow.adminAll)) {
          newList = [], newCoco = [], newLabel = [];
          for (let j=0; j<dirList.length; j++) {
            if (dirCoco [j].indexOf ("*") < 0) {
              newList.push (dirList [j])
              newCoco.push (dirCoco [j])
              newLabel.push (dirLabel [j])
            }
          }
          dirList = newList;
          dirCoco = newCoco;
          dirLabel = newLabel;

        } else { // Modify the star appearance
          for (let j=0; j<dirCoco.length; j++) {
            dirCoco [j] = dirCoco [j].replace (/\*/, "—*");
          }
        }
        // Don't keep current album visible if not in dirList:
        let curr = $ ("#imdbDir").text ().match(/\/.*$/); // Remove imdbLink
        if (curr) {curr = curr.toString ();} else {
          curr = "£"; // Side effect: imdb cannot be hidden
        }
        let ix = dirList.indexOf (curr);
        if ($ ("#imdbDir").text ().length > 0 && ix < 0) {
          document.getElementById ("imageList").className = "hide-all";
          $ ("#imdbDir").text (""); // Remove active album
        } else { // ... but save for selection if present in dirList:
          tempStore = ix + 1; // ELSEWHERE:
          //$ (".ember-view.jstree").jstree ("select_node", $ ("#j1_" + tempStore));
        }
        dirList = dirList.join ("\n");
        $ ("#imdbDirs").text (dirList);//här
        dirCoco = dirCoco.join ("\n");
        $ ("#imdbCoco").text (dirCoco);
        dirLabel = dirLabel.join ("\n"); // Don't trim!
        $ ("#imdbLabels").text (dirLabel);
        resolve (dirList);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
  }).catch (error => {
    if (error.status !== 404) {
      console.error (error.message);
    } else {
      console.log (error.status, error.statusText, "or NodeJS server error?");
    }
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getBaseNames (IMDB_DIR) { // ===== Request imgfile basenames from a server directory
  return new Promise ( (resolve, reject) => {
    if (IMDB_DIR.slice (-1) !== "/") {IMDB_DIR = IMDB_DIR + "/";}
    IMDB_DIR = IMDB_DIR.replace (/\//g, "@");
    var xhr = new XMLHttpRequest ();
    xhr.open ('GET', 'basenames/' + IMDB_DIR, true, null, null);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        var result = xhr.responseText;
        //userLog ('NAMES received');
        resolve (result);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
  }).catch (error => {
    console.error (error.message);
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function getFilestat (filePath) { // Request a file's statistics/information
  return new Promise ( (resolve, reject) => {
    var xhr = new XMLHttpRequest ();
    xhr.open ('GET', 'filestat/' + filePath.replace (/\//g, "@"), true, null, null);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        var data = xhr.responseText.trim ();
        resolve (data);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function fileWR (filePath) { // Request a server file's exist/read/write status/permission
  // Returns '', 'R', or 'WR', indicating missing, readable, or read/writeable
  return new Promise ( (resolve, reject) => {
    var xhr = new XMLHttpRequest ();
    xhr.open ('GET', 'wrpermission/' + filePath.replace (/\//g, "@"), true, null, null);
    //console.log(filePath);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        var data = xhr.responseText.trim ();
        resolve (data);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function resetBorders () { // Reset all mini-image borders and SRC attributes
  var minObj = $ (".img_mini img.left-click");
  minObj.css ('border', '0.25px solid #888');
  //console.log("--- resetBorders");
  minObj.removeClass ("dotted");
  // Resetting all minifile SRC attributes ascertains that any minipic is shown
  // (maybe created just now, e.g. at upload, any outside-click will show them)
  for (var i=0; i<minObj.length; i++) {
    var toshow = minObj [i];
    var minipic = toshow.src;
    $ (toshow).removeAttr ("src").attr ("src", minipic);
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function markBorders (picName) { // Mark a mini-image border
  $ ('#i' + escapeDots (picName) + ".img_mini img.left-click").addClass ("dotted");
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
window.markBorders = function (picName) { // Mark a mini-image border
  $ ('#i' + escapeDots (picName) + ".img_mini img.left-click").addClass ("dotted");
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function escapeDots (txt) { // Escape dots, for CSS names
  // Use e.g. when file names are used in CSS, #<id> etc.
  return txt.replace (/\./g, "\\.");
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function cosp (textArr, system) { // Convert an array of text strings
  // into a comma+space[and]-separated text string
  var andSep = " och"; // i18n
  if (system) {andSep = ", and"}
  if (textArr.length === 1) {return textArr [0]} else {
    return textArr.toString ().replace (/,/g, ", ").replace (/,\s([^,]+)$/, andSep + " $1")
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function removeUnderscore (textString, noHTML) {
  return textString.replace (/_/g, noHTML?" ":"&nbsp;");
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function extractContent(htmlString) { // Extracts text from an HTML string
  var span= document.createElement('span');
  span.innerHTML = htmlString;
  return span.textContent || span.innerText;
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function devSpec () { // Device specific features/settings
  // How do we make context menus with iPad/iOS?
  if ( (navigator.userAgent).includes ("iPad")) {
    /*/ Disable iOS overscroll
    document.body.addEventListener('touchmove', function(event) {
      event.preventDefault();
    }, false);*/
    $ (".nav_.qnav_").hide (); // the help link, cannot use click-in-picture...
    $ ("#full_size").hide (); // the full size image link
    $ (".nav_.pnav_").hide (); // the print link
  }
  if (window.screen.width < 500) {
    $ ("#full_size").hide (); // the full size image link
    $ ("#do_print").hide (); // the printout link
    $ ("a.toggleAuto").hide (); // slide show button
  }
  return false;
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function disableSettings () { // Disables the confirm button, and all checkboxes
  //document.querySelector ('div.settings button.confirm').disabled = true;
  $ ("div.settings button.confirm").prop ("disabled", true);
  for (var i=0; i<allowvalue.length; i++) {
    document.querySelectorAll ('input[name="setAllow"]') [i].disabled = true;
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function aData (dirList) { // Construct the jstree data template from dirList
  var d = dirList;  // the dirList vector should be strictly sorted
  for (i=0; i<dirList.length; i++) {
    d [i] = d [i].replace (/^[^/]*/, ".");
  }
  var r = ''; // for resulting data
  if (d.length <1) {return r;}
  var i = 0, j = 0;
  var li_attr = 'li_attr:{onclick:"return false",draggable:"false",ondragstart:"return false"},';
  // The first element ('dirList [0]') is the link to the root dir (with no '/'):
  r = '[ {text:"' + dirList [0] + '",' + 'a_attr:{title:"' + d [0] + '"},' +li_attr+ '\n';
  var nc = -1; // children level counter
  var b = [dirList [0]];
  for (i=1; i<dirList.length; i++) {
    // The following elements of 'd' (1, 2, ...):
    var a_attr = 'a_attr:{title:"' + d [i] + '"},'
    var s = b; // branch before
    b = dirList [i].split ("/"); // branch
    if (b.length > s.length) { // start children
      r += 'children: [\n';
      nc += 1; // always one step up
    } else if (b.length < s.length) { // end children
      r += '}';
      for (j=0; j<s.length - b.length; j++) {
        r += ' ]}';
      }
      r += ',\n';
      nc -= s.length - b.length; // one or more steps down
    } else {
      r += '},\n';
    }
    r += '{text:"' + b [b.length - 1] + '",' + a_attr + li_attr + '\n';
  }
  r += '}]}';
  for (i=0; i<nc; i++) {r += ' ]}';}
  r += ' ]\n';
  if (d.length === 1) {r = r.slice (0, r.length - 4);} // Surplus "} ]" characters
  return r; // Don't removeUnderscore here!
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function serverShell (anchor) { // Send commands in 'anchor text' to server shell
  var cmds = $ ("#"+anchor).text ();
  cmds = cmds.split ("\n");
  let commands = [];
  for (var i=0; i<cmds.length; i++) {
    if (cmds [i].length > 1 && cmds [i].slice (0, 1) !== "#") { // Skip comment lines
      commands.push (cmds [i]);
    }
  }
  commands = commands.join ("\n").trim ();
  if (commands) {
    mexecute (commands).then (result => {
      if (result.toString ().trim ()) {
          console.log (result);
      }
    });
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function mexecute (commands) { // Execute on the server, return a promise
  let data = new FormData ();
  data.append ("cmds", commands);
  return new Promise ( (resolve, reject) => {
    let xhr = new XMLHttpRequest ();
    xhr.open ('POST', 'mexecute/');
    xhr.onload = function () {
      resolve (xhr.responseText); // usually empty
    };
    xhr.onerror = function () {
      resolve (xhr.statusText);
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send (data);
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function execute (command) { // Execute on the server, return a promise
  return new Promise ( (resolve, reject) => {
    var xhr = new XMLHttpRequest ();
    command = command.replace (/%/g, "%25");
    xhr.open ('GET', 'execute/' + encodeURIComponent (command.replace (/\//g, "@")), true, null, null);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        var data = xhr.responseText.trim ();
        resolve (data);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject ({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send ();
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function ediTextSelWidth () { // Selects a useful edit dialog width within available screen (px)
  var sw = parseInt ( (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth)*0.95);
  if (sw > 750) {sw = 750;}
  return sw;
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Prepare dialogs
var prepDialog = () => {
    $ ("#helpText").dialog ({autoOpen: false, resizable: true, title: "Användarhandledning"}); // Initiate a dialog...
    $ (".ui-dialog .ui-dialog-titlebar-close").text ("×");
    //$ ("#helpText").dialog ("close"); // and close it
    // Initiate a dialog, ready to be used:
    $ ("#dialog").dialog ({resizable: true}); // Initiate a dialog...
    $ (".ui-dialog .ui-dialog-titlebar-close").text ("×");
    $ ("#dialog").dialog ("close"); // and close it
    // Close on click off a modal dialog with overlay:
    $ ("body").on ("click", ".ui-widget-overlay", function () {
      $ ("#dialog").dialog ( "close" );
    });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Prepare the dialog for text search
let prepSearchDialog = () => {
  $ ( () => {
    let sw = ediTextSelWidth () - 25; // Dialog width
    let tw = sw - 25; // Text width
    $ ("#searcharea").css ("width", sw + "px");
    $ ("#searcharea textarea").css ("min-width", tw + "px");
    $ ("#searcharea").dialog ( {
      title: "Finn bilder: Sök i bildtexter",
      closeText: "×",
      autoOpen: false,
      closeOnEscape: true,
      modal: false
    });
    $ ("#searcharea").dialog ('option', 'buttons', [
      {
        text: " Sök ", // findText should update
        //"id": "findBut",
        class: "findText",
        click: function () {
          // Replace [ \n]+ with a single space
          // Replace % == NBSP with space later in the searchText function!
          let sTxt = $ ('textarea[name="searchtext"]').val ().replace (/[ \n]+/g, " ").trim ()
          if (sTxt.length < 3) {
            $ ('textarea[name="searchtext"]').val ("");
            $ ('textarea[name="searchtext"]').focus ();
          } else {
            $ ("button.updText").hide ();
            $ ("button.findText").show ();
            age_imdb_images (); // Show the time since the data was collected
            let and = $ ('input[type="radio"]') [0].checked;
            let boxes = $ ('.srchIn input[type="checkbox"]');
            let sWhr = [];
            let n = 0;
            for (let i=0; i<boxes.length; i++) {
              // sWhr: Search where checkboxes
              sWhr [i] = boxes [i].checked;
              if (sWhr [i]) {n++}
            } // If no search alternative is checked, check at least the first
            if (!n) {
              boxes [0].checked = true;
            }
            spinnerWait (true);
            document.getElementById ("stopSpin").innerHTML = "";
            stopSpinStopSpin ();

            doFindText (sTxt, and, sWhr);

          }
        }
      },
      {
        text: " Stäng ",
        click: () => {
          $ ("#searcharea").dialog ("close");
        }
      },
      {
        text: "reload", // findText should update
        title: "",
        //"id": "updBut",
        class: "updText",
        click: function () {
          $ ("div[aria-describedby='searcharea']").hide ();
          //spinnerWait (true);
          load_imdb_images ().then ( () => {
            //console.log(result);
            later ( ( () => {
              //age_imdb_images ();
              //spinnerWait (false);
              //userLog ("DATABASE reloaded");
              age_imdb_images ();
            }), 2000);
          });
        }
      },
    ]);
    if (!(allow.notesView || allow.adminAll)) {
      document.getElementById ("t3").parentElement.style.display = "none";
    }
    $ ("button.ui-dialog-titlebar-close").attr ("title", "Stäng"); // i18n
    //let txt = $ ("button.ui-dialog-titlebar-close").html (); // Close => ×
    //txt.replace (/Close/, "×");                              // Close => ×
    //$ ("button.ui-dialog-titlebar-close").html (txt);        // Close => ×
    $ ("div[aria-describedby='searcharea'] span.ui-dialog-title")
      .html ('Finn bilder <span style="color:green">(ej länkar)</span>: Sök i bildtexter');
  });
} // end prepSearchDialog
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Find texts in the database (file _imdb_images.sqlite) and
// populate the #picFound album with the corresponding images
// 'sTxt' = whitespace separated search text words/items
// 'and' and 'sWhr' (searchWhere) are search dialog logical settings
// When 'exact' is true, the LIKE searched items will not be '%' surrounded
// Example. Find pictures by exact matching of image names (file basenames):
// doFindText ("img_0012 img_0123", false, [false, false, false, false, true], true)
let doFindText = (sTxt, and, sWhr, exact) => {
  let nameOrder = [];
  searchText (sTxt, and, sWhr, exact).then (result => {
    // replace '<' and '>' for presentation in the header below
    sTxt = sTxt.replace (/</g, "&lt;").replace (/>/g, "&gt;");
    $ ("#temporary_1").text ("");
    let cmd = [];
    // Insert links of found pictures into picFound:
    let n = 0, paths = [], albs = [];
    // Maximum number of pictures from the search results to show:
    let nLimit = 100;
//console.log("searchText result:\n" + result);
    if (result) {
      paths = result.split ("\n").sort (); // Sort entries (see there)
      let chalbs = $ ("#imdbDirs").text ().split ("\n");
//console.log("searchText paths:", paths);
//console.log("searchText chalbs:", chalbs);
      n = paths.length;
//console.log("a)",n);
      let lpath = $ ("#imdbLink").text () + "/" + $ ("#picFound").text ();
      for (let i=0; i<n; i++) {
        let chalb = paths [i].replace (/^[^/]+(.*)\/[^/]+$/, "$1");
        if (!(chalbs.indexOf (chalb) < 0)) {
          let fname = paths [i].replace (/^.*\/([^/]+$)/, "$1");
          let linkfrom = paths [i];
          linkfrom = "../".repeat (lpath.split ("/").length - 1) + linkfrom.replace (/^[^/]*\//, "");

          // In order to show duplicates make the link names unique
          // by adding four random characters (r4) to the basename (n1)
          let n1 = fname.replace (/\.[^.]*$/, "");
          let n2 = fname.replace (/(.+)(\.[^.]*$)/, "$2");
          let r4 = Math.random().toString(36).substr(2,4);
          fname = n1 + "." + r4 + n2;
          nameOrder.push (n1 + "." + r4 + ",0,0");

          let linkto = lpath + "/" + fname;
          cmd.push ("ln -sf " + linkfrom + " " + linkto);
          //if (albs.length < nLimit) {
          //}
          albs.push (paths [i]);
        }
      }
    }
    paths = albs;

    // Sort the entries according to search items if they correspond to
    // exact file base names (else keep the previous sort order) (see there)
    n = paths.length;
//console.log("b)",n);
    let obj = [];
    let filesFound = 0;
    let srchTxt = sTxt.split (" ");
    for (let i=0; i<n; i++) {
      //console.log(i);
      obj [i] = ({"path": paths [i], "name": "_NA_", "cmd": cmd [i], "sortIndex": 9999});
      for (let j=0; j<srchTxt.length; j++) {
        if (paths [i].replace (/^.*\/([^/]+)$/, "$1").indexOf (srchTxt [j]) > -1) {
          obj [i] = ({"path": paths [i], "name": nameOrder [i], "cmd": cmd [i], "sortIndex": j + 1});
          filesFound++;
          break;
        }
      }
    }
    let sobj;
    if (filesFound < 3) { // Since ...?
      //console.log("obj",obj);
      sobj = obj.sort ( (a, b) => {return a.sortIndex - b.sortIndex})
      //console.log("sobj",sobj);
      //console.log("paths",paths);
    } else {
      sobj = obj;
    }
    obj = null;

    paths = [];
    //nameOrder = [];
    cmd = [];
    for (let i=0; i<n; i++) {
      paths.push (sobj [i].path);
      //nameOrder.push (sobj [i].name);
      if (i < nLimit) cmd.push (sobj [i].cmd);
    }
    sobj = null;

    nameOrder = nameOrder.sort ().join ("\n");
    $ ("#temporary_1").text (cmd.join ("\n"));

    // Regenerate the picFound album: the shell commands must execute in sequence
    let lpath = $ ("#imdbLink").text () + "/" + $ ("#picFound").text ();
    execute ("rm -rf " +lpath+ " && mkdir " +lpath+ " && touch " +lpath+ "/.imdb").then ();
    userLog (n + " FOUND");
    let txt = removeUnderscore ($ ("#picFound").text ().replace (/\.[^.]{4}$/, ""), true);
    let yes;
    later ( ( () => {
      yes ="Visa i <b>" + txt + "</b>";
    }), 40);
    let modal = false;
    let p3 =  "<p style='margin:-0.3em 1.6em 0.2em 0;background:transparent'>" + sTxt + "</p>Funna i <span style='font-weight:bold'>" + $ ("#imdbRoot").text () + "</span>:&nbsp; " + n + (n>nLimit?" (i listan, bara " + nLimit + " kan visas)":"");
    later ( ( () => {
      // Run `serverShell ("temporary_1")` -> symlink creation, via `infoDia (null, "", ...
      let imdbx = new RegExp ($ ("#imdbLink").text () + "/", "g");
      infoDia (null, "", p3, "<div style='text-align:left;margin:0.3em 0 0 2em'>" + paths.join ("<br>").replace (imdbx, "./") + "</div>", yes, modal);
      later ( ( () => {
        if (n === 0) {
          document.getElementById("yesBut").disabled = true;
          let btFind ="<br><button style=\"border:solid 2px white;background:moccasin;\" onclick='$(\"#dialog\").dialog(\"close\");$(\"div.subAlbum[title=SENASTE]\").click();$(\"a.search\").click();'>TILLBAKA</button>";
          document.getElementById("dialog").innerHTML = btFind;
          $("#dialog button") [0].focus();
        }
      }), 40);
      $ ("button.findText").show ();
      $ ("button.updText").css ("float", "right");
      displayPicFound ();
      // Save 'nameOrder' as the picFound album's namelist:
      later ( ( () => {
        saveOrderFunc (nameOrder.trim ()).then ( () => {
//==          spinnerWait (false);
          if (n && n <= 100 && loginStatus === "guest") { // Simply show the search result at once...
            later ( ( () => {
              $ ("div[aria-describedby='dialog'] button#yesBut").click ();
              //if (n === 1) {parentAlbum ();} // go directly to the album it links to
            }), 200);
          } // ...else inspect and decide whether to click the show button
        });
      }), 600);
    }), 2000);
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Display found-pictures album link in jstree, and the album
function displayPicFound () {
  $ ("div[aria-describedby='searcharea']").hide ();
  let index = 1 + $ ("#imdbDirs").text ().split ("\n").indexOf ("/" + $ ("#picFound").text ());
  $ (".ember-view.jstree").jstree ("close_all");
  $ (".ember-view.jstree").jstree ("_open_to", "#j1_" + index);
  //console.log($ ("#picFound").text () + " (index = " + index + ")");
  $ (".ember-view.jstree").jstree ("deselect_all");
  $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_" + index));
  $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
  /*later ( ( () => {
    $ ("#j1_" + index + "_anchor").click ();
console.log("#j1_" + index + "_anchor");
}), 4000);*/
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Search the image texts in the current imdbRoot
function searchText (searchString, and, searchWhere, exact) {
  hideShow_g ();
  ediTextClosed ();
  let ao = "", AO;
  if (and) {AO = " AND "} else {AO = " OR "}
  let arr = searchString;
  if (arr === "") {arr = undefined;}
  let str = "";
  if (arr) {
    arr = arr.split (" ");
    for (let i = 0; i<arr.length; i++) {
      // Replace any `'` with `''`, will be enclosed with `'`s in SQL
      arr[i] = arr [i].replace (/'/g, "''") + "";
      // Replace underscore to be taken literally, needs `ESCAPE '\'`
      arr[i] = arr [i].replace (/_/g, "\\_") + "";
      // First replace % (thus, NBSP):
      arr[i] = arr [i].replace (/%/g, " ");
      // Then use % the SQL way if applicable, and add `ESCAPE '\'`:
      if (exact) { // Exact match for e.g. file (base) names
        arr [i] = "'" + arr [i] + "' ESCAPE '\\'";
      } else {
        arr [i] = "'%" + arr [i] + "%' ESCAPE '\\'";
      }
      if (i > 0) {ao = AO + "\n"}
      str += ao + "txtstr LIKE " + arr[i].trim ();
    }
    str = str.replace (/\n/g, "");
  }
  if (!$ ("#imdbDir").text ()) {
    $ ("#imdbDir").text ($ ("#imdbLink").text () + "/" + $ ("#picFound").text ());
  }
  let srchData = new FormData ();
  srchData.append ("like", str);
  srchData.append ("cols", searchWhere);
  srchData.append ("info", "not used yet");
  return new Promise ( (resolve, reject) => {
    let xhr = new XMLHttpRequest();
    let imdbroot = $ ("#imdbRoot").text ();
    xhr.open ('POST', 'search/' + imdbroot);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        let data = xhr.responseText.trim ();
//console.log("response data:\n" + data);
        //data.sort
        resolve (data);
      } else {
        reject ({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.send (srchData);
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// https://stackoverflow.com/questions/30605298/jquery-dialog-with-input-textbox etc.
// Prepare the dialog for the image texts editor
var prepTextEditDialog = () => {
//$ ( () => {
  var sw = ediTextSelWidth (); // Selected dialog width
  var tw = sw - 25; // Text width
  /*$ ('<div id="textareas" style="margin:0;padding:0;width:'+sw+'px"><div class="diaMess"><span class="edWarn"></span></div><textarea name="description" rows="6" style="min-width:'+tw+'px" /><br><textarea name="creator" rows="1" style="min-width:'+tw+'px" /></div>').dialog ( {
    title: "Bildtexter",
    //closeText: "×", // Replaced (why needed?) below by // Close => ×
    autoOpen: false,
    draggable: true,
    closeOnEscape: false, // NOTE: handled otherwise
    modal: false
  });*/

  $ ("#textareas").dialog ({
    title: "Bildtexter",
    closeText: "×", // Set title below
    autoOpen: false,
    draggable: true,
    closeOnEscape: false, // NOTE: handled otherwise
    modal: false
  });
  $ ("#textareas").css ("width", sw + "px");
  $ ('textarea[name="description"]').css ("min-width", tw + "px");
  $ ('textarea[name="creator"]').css ("min-width", tw + "px");

//((()))
//later ( ( () => {
  $ ("#textareas").dialog ('option', 'buttons', [
    {
      text: "Anteckningar",
      class: "notes",
      click: () => { // 'Non-trivial' dialog button, to the 'notes' new level
        var namepic = $ ("div[aria-describedby='textareas'] span.ui-dialog-title span").html ();
        var ednp = escapeDots (namepic);
        var linkPath = $ ("#i" + ednp + " img").attr ("title");
        linkPath = $ ("#imdbLink").text () + "/" + linkPath;
        var filePath = linkPath; // OK if not a link
        function xmpGetSource () {
          execute ("xmpget source " + filePath).then (result => {
            notesDia (namepic, filePath, "Anteckningar till ", result, "Spara", "Spara och stäng", "Stäng");
          });
        }
        if ($ ("#i" + ednp).hasClass ("symlink")) {
          getFilestat (linkPath).then (result => {
            //console.log (result); // The file info HTML, strip it:
            result = result.replace (/^.+: ((\.){1,2}\/)+/, $ ("#imdbLink").text () + "/");
            result = result.replace (/^([^<]+)<.+/, "$1");
            filePath = result;
          }).then ( () => {
            xmpGetSource ();
            return;
          })
        } else {
          xmpGetSource ();
        }
      }
    },
    {
      text: " Spara ",
      //"id": "saveBut",
      class: "saveTexts block",
      click: function () {
        var namepic = $ ("div[aria-describedby='textareas'] span.ui-dialog-title span").html ();
        var text1 = $ ('textarea[name="description"]').val ();
        var text2 = $ ('textarea[name="creator"]').val ();
        storeText (namepic, text1, text2);
      }
    },
    {
      text: " Spara och stäng ",
      class: "saveTexts block",
      click: () => {
        var namepic = $ ("div[aria-describedby='textareas'] span.ui-dialog-title span").html ();
        var text1 = $ ('textarea[name="description"]').val ();
        var text2 = $ ('textarea[name="creator"]').val ();
        storeText (namepic, text1, text2);
        ediTextClosed ();
      }
    },
    {
      text: " Stäng ",
      class: "block",
      click: () => {
        ediTextClosed ();
      }
    },
    {
      text: "Nyckelord",
      class: "keys",
      click: () => { // "Non-trivial" dialog button, to a new level
        infoDia (null, "","Nyckelord", "Ord lagrade som metadata<br>som kan användas som särskilda sökbegrepp:<br><br>Planerat framtida tillägg", "Ok", true);
      }
    }
  ]);
  // Set close title:
  $ ("div.ui-dialog-titlebar button.ui-dialog-titlebar-close").attr ("title", "Stäng"); // i18n
//  var txt = $ ("div.ui-dialog-titlebar button.ui-dialog-titlebar-close").html (); // Close => ×
//  txt.replace (/Close/, "×");                              // Close => ×
//  $ ("div.ui-dialog-titlebar button.ui-dialog-titlebar-close").html (txt);        // Close => ×
  // Set close action ...
  // NOTE this clumpsy direct reference to jquery (how directly trigger ediTextClosed?):
  $ ("div.ui-dialog-titlebar button.ui-dialog-titlebar-close").attr ("onclick",'$("div[aria-describedby=\'textareas\'] span.ui-dialog-title span").html("");$("div[aria-describedby=\'textareas\']").hide();$("#navKeys").text("true");$("#smallButtons").show();');

  $ ("button.block").wrapAll ('<div id="glued" style="display:inline-block;white-space:nowrap;"></div>');
//}), 800);
//((()))
  function storeText (namepic, text1, text2) {
    text1 = text1.replace (/ +/g, " ").replace (/\n /g, "<br>").replace (/\n/g, "<br>").trim ();
    text2 = text2.replace (/ +/g, " ").replace (/\n /g, "<br>").replace (/\n/g, "<br>").trim ();
    // Show what was saved:
    $ ('textarea[name="description"]').val (text1.replace (/<br>/g, "\n"));
    $ ('textarea[name="creator"]').val (text2.replace (/<br>/g, "\n"));
    var ednp = escapeDots (namepic);
    var fileName = $ ("#i" + ednp + " img").attr ("title");
    fileName = $ ("#imdbLink").text () + "/" + fileName;
    $ ("#i" + ednp + " .img_txt1" ).html (text1);
    $ ("#i" + ednp + " .img_txt1" ).attr ("title", text1.replace(/<[^>]+>/gm, " "));
    $ ("#i" + ednp + " .img_txt1" ).attr ("totip", text1.replace(/<[^>]+>/gm, " "));
    $ ("#i" + ednp + " .img_txt2" ).html (text2);
    $ ("#i" + ednp + " .img_txt2" ).attr ("title", text2.replace(/<[^>]+>/gm, " "));
    $ ("#i" + ednp + " .img_txt2" ).attr ("totip", text2.replace(/<[^>]+>/gm, " "));
    if ($ (".img_show .img_name").text () === namepic) {
      $ ("#wrap_show .img_txt1").html (text1);
      //document.querySelector ("#wrap_show .img_txt1").innerHTML = text1;
      $ ("#wrap_show .img_txt2").html (text2);
    }
    // Cannot save metadata in GIFs:
    if (fileName.search (/\.gif$/i) > 0) return;
    // Get real file name if symlink:
    let linkPath = fileName;
    if ($ ("#i" + ednp).hasClass ("symlink")) {
      getFilestat (linkPath).then (result => {
        //console.log (result); // The file info HTML, strip it:
        result = result.replace (/^.+: ((\.){1,2}\/)+/, $ ("#imdbLink").text () + "/");
        result = result.replace (/^([^<]+)<.+/, "$1");
        fileName = result;
      }).then ( () => {
        saveText (fileName +'\n'+ text1 +'\n'+ text2);
        return;
      })
    } else {
      saveText (fileName +'\n'+ text1 +'\n'+ text2);
    }
    // ===== XMLHttpRequest saving the text
    function saveText (txt) {
      var IMDB_DIR =  $ ("#imdbDir").text ();
      if (IMDB_DIR.slice (-1) !== "/") {IMDB_DIR = IMDB_DIR + "/";} // Important!
      IMDB_DIR = IMDB_DIR.replace (/\//g, "@"); // For sub-directories

      var xhr = new XMLHttpRequest ();
      xhr.open ('POST', 'savetext/' + IMDB_DIR); // URL matches server-side routes.js
      xhr.onload = function () {
        if (xhr.responseText) {
          userLog ("NOT written");
          $ ("#i" + ednp + " .img_txt1" ).html ("");
          $ ("#i" + ednp + " .img_txt2" ).html ("");
          infoDia (null, null,"Texten sparades inte!", '<br>Bildtexten kan inte uppdateras på grund av<br>något åtkomsthinder &ndash; är filen ändringsskyddad?<br><br>Eventuell tillfälligt förlorad text återfås med ”Återställ osparade ändringar”', "Ok", true);
        } else {
          userLog ("TEXT written", false, 2000);
          //console.log ('Xmp.dc metadata saved in ' + fileName);
        }
      }
      xhr.send (txt);
    }
  }
//});
} // end prepTextEditDialog
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Refresh the editor dialog content
function refreshEditor (namepic, origpic) {
  $ ("div[aria-describedby='textareas'] span.ui-dialog-title").html ("Bildtexter till <span class='blue'>" + namepic + "</span>");
  // Take care of the notes etc. buttons:
  if (!(allow.notesView || allow.adminAll)) {

    document.querySelector ("div[aria-describedby='textareas'] .ui-dialog-buttonset button.notes").disabled = true;
    //$ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button.notes").css ("display", "none");
    $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button.keys").css ("display", "none");
  } else {
    document.querySelector ("div[aria-describedby='textareas'] .ui-dialog-buttonset button.notes").disabled = false;
    //$ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button.notes").css ("display", "inline");
    $ ("div[aria-describedby='textareas'] .ui-dialog-buttonset button.keys").css ("display", "inline");
  }
  $ ("#textareas .edWarn").html ("");
  let warnText = "";
  if ($ ("button.saveTexts").attr ("disabled")) { // Cannot save if not allowed
    warnText += nosObs;
    //$ ("#textareas .edWarn").html (nosObs); // Nos = no save
  }
  if (origpic.search (/\.gif$/i) > 0) {
    // Don't display the notes etc. buttons:
    warnText += (warnText?"<br>":"") + nopsGif;
    $ (".ui-dialog-buttonset button.notes").css ("display", "none");
    $ (".ui-dialog-buttonset button.keys").css ("display", "none");
  }
  warnText = "<b style='float:left;cursor:text'> &nbsp; ’ – × ° — ” &nbsp; </b>" + warnText;

  if (warnText) {$ ("#textareas .edWarn").html (warnText);}
  // Load the texts to be edited after positioning to top
  $ ('textarea[name="description"]').html ("");
  $ ('textarea[name="creator"]').html ("");
  $ ("#textareas").dialog ("open"); // Reopen
  $ ('textarea[name="description"]').focus ();
  later ( ( () => {
    $ ('textarea[name="creator"]').val ($ ('#i' + escapeDots (namepic) + ' .img_txt2').html ().trim ().replace (/<br>/g, "\n"));
    $ ('textarea[name="description"]').val ($ ('#i' + escapeDots (namepic) + ' .img_txt1').html ().trim ().replace (/<br>/g, "\n"));
  }), 80);
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Allowance settings
// 'allowance' contains the property names array for 'allow'
// 'allowvalue' is the source of the 'allow' property values
// 'allow' has settings like 'allow.deleteImg' etc.
var allowance = [ // 'allow' order
  "adminAll",     // + allow EVERYTHING
  "albumEdit",    // +  " create/delete album directories
  "appendixEdit", // o  " edit appendices (attached documents)
  "appendixView", // o  " view     "
  "delcreLink",   // +  " delete and create linked images NOTE *
  "deleteImg",    // +  " delete (= remove, erase) images NOTE *
  "imgEdit",      // o  " edit images
  "imgHidden",    // +  " view and manage hidden images
  "imgOriginal",  // +  " view and download full size images
  "imgReorder",   // +  " reorder images
  "imgUpload",    // +  " upload    "
  "notesEdit",    // +  " edit notes (metadata) NOTE *
  "notesView",    // +  " view   "              NOTE *
  "saveChanges",  // +  " save order/changes (= saveOrder)
  "setSetting",   // +  " change settings
  "textEdit"      // +  " edit image texts (metadata)
];
var allowSV = [ // Ordered as 'allow', IMPORTANT!
  "Får göra vadsomhelst",
  "göra/radera album",
  "(arbeta med bilagor +4)",
  "(se bilagor)",
  "flytta till annat album, göra/radera länkar",
  "radera bilder +5",
  "(redigera bilder)",
  "gömma/visa bilder",
  "se högupplösta bilder",
  "flytta om bilder inom album",
  "ladda upp originalbilder till album",
  "redigera/spara anteckningar +13",
  "se anteckningar",
  "spara ändringar utöver text",
  "ändra inställningar",
  "redigera/spara bildtexter, gömda album"
];
var allowvalue = "0".repeat (allowance.length);
$ ("#allowValue").text (allowvalue);
var allow = {};
function zeroSet () { // Called from logIn at logout
  $ ("#allowValue").text ("0".repeat (allowance.length));
}
function allowFunc () { // Called from setAllow (which is called from init(), logIn(), toggleSettings(),..)
  allowvalue = $ ("#allowValue").text ();
  for (var i=0; i<allowance.length; i++) {
    allow [allowance [i]] = Number (allowvalue [i]);
    //console.log(allowance[i], allow [allowance [i]]);
  }
  if (allow.deleteImg) {  // NOTE *  If ...
    allow.delcreLink = 1; // NOTE *  then set this too
    i = allowance.indexOf ("delcreLink");
    allowvalue = allowvalue.slice (0, i - allowvalue.length) + "1" + allowvalue.slice (i + 1 - allowvalue.length); // Also set the source value (in this way since see below)
    //allowvalue [i] = "1"; Gives a weird compiler error: "4 is read-only" if 4 = the index value
  }
  if (allow.notesEdit) { // NOTE *  If ...
    allow.notesView = 1; // NOTE *  then set this too
    i = allowance.indexOf ("notesView");
    allowvalue = allowvalue.slice (0, i - allowvalue.length) + "1" + allowvalue.slice (i + 1 - allowvalue.length);
  }
  // Hide smallbuttons we don't need:
  if (allow.adminAll || allow.saveChanges) { // For anonymous user who may reorder
    $ ("#saveOrder").show ();
  } else {
    $ ("#saveOrder").hide ()
  }
  /*if (allow.adminAll || allow.imgHidden) {
    $ ("#toggleHide").show ();
  } else {
    $ ("#toggleHide").hide ();
  }*/
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
// Disable browser back button
history.pushState (null, null);
window.onpopstate = function () {
  if ($ ("div[aria-describedby='dialog']").is (":visible")) {
    $ ("#dialog").dialog ("close");
  } else {
    infoDia (null, null, "M E D D E L A N D E", "<b style='color:#060'><br>Du använder just nu en webb-app<br>med bara en enda sida som det inte går att<br>backa ifrån på det sättet.<br><br>Använd i stället appens egna navigerings-<br>menyer, -knappar och/eller -länkar!<br><br>Självklart kan du även avsluta appen genom att<br>stänga sidan eller gå till något helt annat<br>i webbläsarens adressfält.<br>&nbsp;</b>", "Ok, jag förstår!", true);
    history.go(1);
  }
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function showFileInfo () {
  var picName = $ ("#picName").text ();
  var picOrig = $ ("#picOrig").text ();
  var title = "Information";
  var yes = "Ok";
  getFilestat (picOrig).then (result => {
    $ ("#temporary").text (result);
  }).then ( () => {
    if ($ ("#imdbDir").text ().indexOf (picFound) > -1) picName = picName.replace (/^(.+)\.[^.]+$/, "$1");
    var txt = '<i>Namn</i>: <span style="color:black">' + picName + '</span><br>';
    txt += $ ("#temporary").text ();
    var tmp = $ ("#download").attr ("href");
    if (tmp && tmp.toString () != "null") {
      txt += '<br><span class="lastDownload"><i>Senast startad nedladdning</i>:<br>' + tmp + "</span>";
    }
    infoDia (null, picName, title, txt, yes, false);
    $ ("#temporary").text ("");
  });
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function emailOk(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
window.selectJstreeNode = function (idx) { // for child window
  selectJstreeNode (idx);
}
function selectJstreeNode (idx) {
  $ (".ember-view.jstree").jstree ("close_all");
  $ (".ember-view.jstree").jstree ("_open_to", "#j1_" + (1 + idx));
  $ (".ember-view.jstree").jstree ("deselect_all");
  $ (".ember-view.jstree").jstree ("select_node", $ ("#j1_" + (1 + idx)));
  $ (".ember-view.jstree").jstree ("open_node", $ ("#j1_1"));
}
