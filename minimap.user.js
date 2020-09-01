// ==UserScript==
// @name         aquabot v2
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Only tested on Chrome and Edge
// @author       meatie
// @match        https://pixelzone.io/*
// @homepage     https://github.com/limaosa2/asasasassaa/
// @updateURL    https://raw.githubusercontent.com/limaosa2/asasasassaa/master/minimap.user.js
// @grant        none
// ==/UserScript==
/*Based on minimap: https://github.com/Pinkfloydd/ArgentinaMap_PixelZone

Useful console commands:
listTemplates()
setCookie("baseTemplateUrl", "template-path-here")
setCookie("baseTemplateUrl", "")  - now it will prompt for path on reload
*/

const vers = "AQUABOT V2";
const range = 6; //margin for showing the map window
const botInterval = 350; //ms. Controls cpu load. Larger images mean heavy loadtempl
const minDelay_ms = 0; //anti-bot-detect attempt. Used randomized
const verify_x = -882, verify_y = -553; //key V: Verify location
const circle_size = 5;

// Default location of template images and templates.json. Is user input and stored in a cookie.
var baseTemplateUrl = 'https://raw.githubusercontent.com/limaosa2/asasasassaa/master/imagens/';
var baseTemplateBackup = baseTemplateUrl;

vvar zoomlevel, zooming_out, zooming_in, zoom_time, x_world, y_world, centerx, centery;
var coorDOM, gameWindow;
var toggle_show, counter, image_list, needed_templates, mousemoved;
var minimap,  minimap_board, minimap_cursor, minimap_box, minimap_text;
var ctx_minimap, ctx_minimap_board, ctx_minimap_cursor;
var timerDiv, circle;
var botting = false, botjobactive, botcanvas, ctx_gameWindow, capsound;
var verifying = false, colorid = [];
var botpixels, last_mousemove = 0, botEvent = false, botmode = "R";
var pos = {"x":0, "y":0};
var gamezoom, paintcount = 0, diffcount, currentcolor=-1, botcolor, minimum_y, maximum_y, diffX, diffY;
var sounds = [0,0];
var playercountNode, bumpSpan;

Number.prototype.between = function(a, b) {
  var min = Math.min.apply(Math, [a, b]);
  var max = Math.max.apply(Math, [a, b]);
  return this > min && this < max;
};

window.addEventListener('load', function() {
  setTimeout(startup, 400);
}, false);

function startup() {
  var i, a1, a2, r, g, b, t = getCookie("baseTemplateUrl");
  if(!t) {
    t = prompt("Location of template images and templates.json\nhttps: is required. Stores in a cookie.", baseTemplateUrl);
    if(t) setCookie("baseTemplateUrl", t);
  }
  baseTemplateUrl = t;

  console.log(vers+". TemplateUrl", baseTemplateUrl);
  console.log("Try: listTemplates() and keys space, QWERTYUIOP[ ASDFG, X, V, B, C, M");
  gameWindow = document.getElementById("canvas");
  //DOM element of the displayed X, Y
  coorDOM = document.getElementById("coordinatesNote");
  //coordinates of the middle of the window, from url
  centerx = centery = 0;
  //coordinates of cursor
  x_world = y_world = 0;
  //list of all available templates
  window.template_list = null;
  zoomlevel = 14;
  //toggle options
  toggle_show = false;
  zooming_in = zooming_out = false;
  zoom_time = 100;
  //array with all loaded template-images
  window.image_list = [];
  counter = 0;
  //templates which are needed in the current area
  needed_templates = [];
  //Cachebreaker to force image refresh. Set it to eg. 1
  window.cachebreaker = "";

  //make colorid[][][]. It's meant to be a little faster than Colors.getColorIdFromRGB
  colorid = [];
  for(r=0; r<16; r++) {
    a1 = [];
    for(g=0; g<16; g++) {
      a2 = [];
      for(b=0; b<16; b++) {
        t = Colors.colorsPalette[b];
        if(Colors.colorsPalette[r][0]==t[0] && Colors.colorsPalette[g][1]==t[1]) a2[t[2]] = b;
      }
      t = Colors.colorsPalette[g];
      if(Colors.colorsPalette[r][0]==t[0]) a1[t[1]] = a2;
    }
    colorid[Colors.colorsPalette[r][0]] = a1;
  }

  var div = document.createElement('div');
  div.setAttribute('class', 'post block bc2');
  div.innerHTML = '<style>.grecaptcha-badge,#message{display: none}.palette-footer{z-index:5}</style>\n' +
  '<canvas id="botcanvas" style="z-index:9;position:absolute;top:0;left:0;display:none"></canvas>' +
  '<canvas id="botcircle" style="width:'+(circle_size*2+1)+'px; height:'+(circle_size*2+1)+'px;z-index:4;position:absolute;top:0;left:0;display:none"></canvas>' +
  '<div id="minimapbg" style="background-color:rgba(0,0,0,0.7); border-radius:12px; position:absolute; right:6px; bottom:6px; z-index:1;">' +
  '<div class="posy unselectable" id="posyt" style="background-size:100%; color:#fff; text-align:center; line-height:32px; vertical-align:middle; width:auto; height:auto; padding:6px 8px;">' +
  '<div id="minimap-text"></div>' +
  '<div id="minimap-title" style="line-height: 15px; font-size: 0.9em;">' + vers + '</div>' +
  '<div id="minimap-box" style="position: relative;width:390px;height:280px">' +
  '<canvas id="minimap" style="width: 100%; height: 100%;z-index:4;position:absolute;top:0;left:0;"></canvas>' +
  '<canvas id="minimap-board" style="width: 100%; height: 100%;z-index:5;position:absolute;top:0;left:0;"></canvas>' +
  '<canvas id="minimap-cursor" style="width: 100%; height: 100%;z-index:6;position:absolute;top:0;left:0;"></canvas>' +
  '</div><div id="minimap-config" style="line-height:15px;">' +
  ' <span id="hide-map" style="cursor:pointer;">FUGIR' +
  ' </span> | Zoom: <span id="zoom-plus" style="cursor:pointer;font-weight:bold;">&nbsp;+&nbsp;</span>/' +
  ' <span id="zoom-minus" style="cursor:pointer;font-weight:bold;">&nbsp;-&nbsp;</span>' +
  '</div>' +
  '</div>';
  document.body.appendChild(div);

  minimap = document.getElementById("minimap");
  minimap_board = document.getElementById("minimap-board");
  minimap_cursor = document.getElementById("minimap-cursor");
  minimap.width = minimap.offsetWidth;
  minimap_board.width = minimap_board.offsetWidth;
  minimap_cursor.width = minimap_cursor.offsetWidth;
  minimap.height = minimap.offsetHeight;
  minimap_board.height = minimap_board.offsetHeight;
  minimap_cursor.height = minimap_cursor.offsetHeight;
  ctx_minimap = minimap.getContext("2d");
  ctx_minimap_board = minimap_board.getContext("2d");
  ctx_minimap_cursor = minimap_cursor.getContext("2d");
  circle = document.getElementById("botcircle");
  drawCircle();
  timerDiv = document.getElementById("timer");
  minimap_box = document.getElementById("minimap-box");
  minimap_text = document.getElementById("minimap-text");

  playercountNode = document.getElementById("playerCounterNote");
  if(playercountNode) {
    playercountNode = playercountNode.childNodes[0].childNodes[0].childNodes[0];
    bumpSpan = document.createElement('span');
    bumpSpan.setAttribute('style', 'font-size:60%;margin-left:5px');
    playercountNode.parentElement.parentElement.appendChild(bumpSpan);
    setInterval(checkAlive, 1000);
  }

  //No Antialiasing when scaling!
  ctx_minimap.mozImageSmoothingEnabled = false;
  ctx_minimap.webkitImageSmoothingEnabled = false;
  ctx_minimap.msImageSmoothingEnabled = false;
  ctx_minimap.imageSmoothingEnabled = false;

  toggleShow(toggle_show);
  drawBoard();
  drawCursor();
  timerDiv.style.width = "50px";

  /*document.getElementById("minimapbg").onclick = function () {
    toggleShow()
  };*/
  document.getElementById("hide-map").onclick = function () {
    toggleShow(false);
  };
  minimap_text.onclick = function () {
    toggleShow(true);
  };
  document.getElementById("zoom-plus").addEventListener('mousedown', function (e) {
    e.preventDefault();
    zooming_in = true;
    zooming_out = false;
    zoomIn();
  }, false);
  document.getElementById("zoom-minus").addEventListener('mousedown', function (e) {
    e.preventDefault();
    zooming_out = true;
    zooming_in = false;
    zoomOut();
  }, false);
  document.getElementById("zoom-plus").addEventListener('mouseup', function (e) {
    zooming_in = false;
  }, false);
  document.getElementById("zoom-minus").addEventListener('mouseup', function (e) {
    zooming_out = false;
  }, false);

  gameWindow.addEventListener('mouseup', function (evt) {
    if(!toggle_show || botEvent) return;
    setTimeout(getCenter, 1650);
    paintcount = 0;
  }, false);

  gameWindow.addEventListener('mousemove', mymousemove, false);

  var pal = document.getElementsByClassName("palette-container")[0].childNodes[0];
  // Tag the color divs with colorid in .lang
  for(i=0; i<16; i++) {
    var c = i;
    if(c < 2) c = c^1; //XOR
    pal.childNodes[parseInt(c/8)].childNodes[c % 8].lang = i;
    //identify selected one
    if(pal.childNodes[parseInt(c/8)].childNodes[c % 8].childNodes.length) currentcolor = i;
  }
  console.log("currentcolor = "+currentcolor);
  pal.addEventListener('click', (e) => {
    var c = parseInt(e.target.lang);
    if(!isNaN(c)) currentcolor = c;
  }, false);

  window.addEventListener('resize', (e) => {
    if(botting) {
      sound(0);
      console.log("ERROR: Do not resize the window while botting. Pan the window, then start again");
      botStartStop(false);
    }
  });

  setInterval(updateloop, 60000);
  updateloop();

  //mousemove heavy work
  setInterval(function() {
    if(mousemoved) {
      mousemoved = false;
      loadTemplates();
    }
  }, 20);

  setInterval(botJob, botInterval);
}

function mymousemove(evt) {
  if(botEvent || !toggle_show || !coorDOM) return;
  last_mousemove = Date.now();
  var coordsXY = coorDOM.innerHTML.split(/\s?[xy:]+/);
  var x_new = parseInt(coordsXY[1]);
  var y_new = parseInt(coordsXY[2]);
  if (x_world != x_new || y_world != y_new) {
    x_world = x_new;
    y_world = y_new;
    drawCursor();
    mousemoved = true;
  }
}

function checkAlive() {
  if(playercountNode.nodeValue.substr(0,1) != " ") {
    playercountNode.nodeValue = " "+playercountNode.nodeValue;
    playercountNode.bump = Date.now();
    bumpSpan.innerText = 0;
    bumpSpan.parentElement.style.color="unset";
  } else {
    var c = Math.floor((Date.now() - playercountNode.bump)/1000);
    bumpSpan.innerText = c;
    if(c>600) bumpSpan.parentElement.style.color="#f66";
  }
}

window.listTemplates = function () {
  var ttlpx = 0;
  var mdstr = "";
  if(!template_list) {
    console.log("### No templates. Show the minimap first");
    return;
  }
  Object.keys(template_list).map(function (index, ele) {
    var eles = template_list[index];
    if(!eles.name) return;
    var z = eles.width>300 ? 2 : eles.width>100 ? 4 : 8;
    var n = eles.name+"";
    if(n.indexOf("//") < 0) n = baseTemplateUrl + n;
    mdstr += '\n#### ' + index + ' ' + eles.width + 'x' + eles.height + ' ' + n;
    mdstr += ' https://pixelzone.io/?p=' + Math.floor(eles.x + eles.width / 2) + ',' + Math.floor(eles.y + eles.height / 2) + ','+z+'\n';
    if(!isNaN(eles.width) && !isNaN(eles.height)) ttlpx += eles.width * eles.height;
  });
  mdstr = '### Total pixel count: ' + ttlpx + '\n' + mdstr;
  console.log(mdstr);
}

function updateloop() {
  //console.log("Updating Template List");
  if(!toggle_show) return;
  // Get JSON of available templates
  var xmlhttp = new XMLHttpRequest();
	var tfile = "templates.json?";
  var url = baseTemplateUrl + tfile + new Date().getTime();
  xmlhttp.onreadystatechange = function () {
    if(this.readyState == XMLHttpRequest.DONE && this.status == 200) {
      window.template_list = JSON.parse(this.responseText);
      getCenter();
    }
//console.log("## GET", this.readyState, this.status);
    if(this.readyState == XMLHttpRequest.DONE && this.status == 0 && !template_list) {
      baseTemplateUrl = baseTemplateBackup;
      console.log("## TRYING BACKUP URL");
      url = baseTemplateUrl + tfile + new Date().getTime();
      xmlhttp.open("GET", url, true);
      xmlhttp.send();
      loadTemplates();
    }
  };
  xmlhttp.open("GET", url, true);
  xmlhttp.timeout = 6000;
  xmlhttp.send();
  image_list = [];
  loadTemplates();
}

function toggleShow(newValue) {
  if(newValue === undefined) toggle_show = !toggle_show;
  else toggle_show = newValue;
  if(!minimap_box) return;
  if (toggle_show) {
    minimap_box.style.display = "block";
    minimap_text.style.display = "none";
    document.getElementById("minimap-config").style.display = "block";
    loadTemplates();
  } else {
    minimap_box.style.display = "none";
    minimap_text.innerHTML = "sair do arbusto";
    minimap_text.style.display = "block";
    minimap_text.style.cursor = "pointer";
    document.getElementById("minimap-config").style.display = "none";
  }
  //var g = document.getElementsByClassName("grecaptcha-badge"); if(g[0]) g[0].style.display = "none";
}

function zoomIn() {
  if (!zooming_in) return;
  zoomlevel = zoomlevel * 1.2;
  if (zoomlevel > 45) {
    zoomlevel = 45;
    return;
  }
  drawBoard();
  drawCursor();
  loadTemplates();
  setTimeout(zoomIn, zoom_time);
}

function zoomOut() {
  if (!zooming_out) return;
  zoomlevel = zoomlevel / 1.2;
  if (zoomlevel < 1) {
    zoomlevel = 1;
    return;
  }
  drawBoard();
  drawCursor();
  loadTemplates();
  setTimeout(zoomOut, zoom_time);
}

function loadTemplates() {
  if(!toggle_show) return;
  if(window.template_list == null || !minimap_box) return;
  //console.log('loadTemplates',template_list);

  var x_left = x_world * 1 - minimap.width / zoomlevel / 2;
  var x_right = x_world * 1 + minimap.width / zoomlevel / 2;
  var y_top = y_world * 1 - minimap.height / zoomlevel / 2;
  var y_bottom = y_world * 1 + minimap.height / zoomlevel / 2;
  //console.log("x_left : " + x_left);
  //console.log("x_right : " + x_right);
  //console.log("y_top : " + y_top);
  //console.log("y_bottom : " + y_bottom);
  //console.log(template_list);
  var keys = [];
  for (var k in template_list) keys.push(k);
  needed_templates = [];
  for (var i = 0; i < keys.length; i++) {
    var template = keys[i];
    if(!template_list[template].width) continue;
    var temp_x = template_list[template].x;
    var temp_y = template_list[template].y;
    var temp_xr = temp_x + template_list[template].width;
    var temp_yb = temp_y + template_list[template].height;
    // if (temp_xr <= x_left || temp_yb <= y_top || temp_x >= x_right || temp_y >= y_bottom)
    //    continue;
    if (!x_world.between(temp_x-range, temp_xr+range)) continue;
    if (!y_world.between(temp_y-range, temp_yb+range)) continue;
    //console.log("Template " + template + " is in range!");
    needed_templates.push(template);
  }
  if (needed_templates.length == 0) {
    if (zooming_in == false && zooming_out == false) {
      minimap_box.style.display = "none";
      minimap_text.style.display = "block";
      minimap_text.innerHTML = "tudo limpo!";
      minimap_text.style.cursor = "auto";
    }
  } else {
    minimap_box.style.display = "block";
    minimap_text.style.display = "none";
    counter = 0;
    for (i = 0; i < needed_templates.length; i++) {
      if (image_list[needed_templates[i]] == null) {
        loadImage(needed_templates[i]);
      } else {
        counter += 1;
        //if last needed image loaded, start drawing
        if (counter == needed_templates.length) drawTemplates();
      }
    }
  }
}

function loadImage(imagename) {
  console.log("    Load image " + imagename, cachebreaker);
  image_list[imagename] = new Image();
  var src = template_list[imagename].name;
  if(src.indexOf("//") < 0) src = baseTemplateUrl + src;
  if(cachebreaker) src += "?" + cachebreaker;
  image_list[imagename].crossOrigin = "Anonymous";
  image_list[imagename].src = src;
  image_list[imagename].onload = function () {
    counter += 1;
    //if last needed image loaded, start drawing
    if (counter == needed_templates.length) drawTemplates();
  }
}

function drawTemplates() {
  ctx_minimap.clearRect(0, 0, minimap.width, minimap.height);
  var x_left = x_world * 1 - minimap.width / zoomlevel / 2;
  var y_top = y_world * 1 - minimap.height / zoomlevel / 2;
  for (var i = 0; i < needed_templates.length; i++) {
    var template = needed_templates[i];
    var xoff = (template_list[template].x * 1 - x_left * 1) * zoomlevel;
    var yoff = (template_list[template].y * 1 - y_top * 1) * zoomlevel;
    var newwidth = zoomlevel * image_list[template].width;
    var newheight = zoomlevel * image_list[template].height;
    ctx_minimap.drawImage(image_list[template], xoff, yoff, newwidth, newheight);
    //console.log("Drawn!");
  }
}

function drawBoard() {
  ctx_minimap_board.clearRect(0, 0, minimap_board.width, minimap_board.height);
  if (zoomlevel <= 4.6) return;
  ctx_minimap_board.beginPath();
  var bw = minimap_board.width + zoomlevel;
  var bh = minimap_board.height + zoomlevel;
  var xoff_m = (minimap.width / 2) % zoomlevel - zoomlevel;
  var yoff_m = (minimap.height / 2) % zoomlevel - zoomlevel;
  var z = 1 * zoomlevel;
  ctx_minimap_board.lineWidth = 0.2;
  for (var x = 0; x <= bw; x += z) {
    ctx_minimap_board.moveTo(x + xoff_m, yoff_m);
    ctx_minimap_board.lineTo(x + xoff_m, bh + yoff_m);
  }
  for (x = 0; x <= bh; x += z) {
    ctx_minimap_board.moveTo(xoff_m, x + yoff_m);
    ctx_minimap_board.lineTo(bw + xoff_m, x + yoff_m);
  }
  ctx_minimap_board.strokeStyle = "black";
  ctx_minimap_board.stroke();
}

function drawCursor() {
  var x_left   = x_world * 1 - minimap.width / zoomlevel / 2;
  var x_right  = x_world * 1 + minimap.width / zoomlevel / 2;
  var y_top    = y_world * 1 - minimap.height / zoomlevel / 2;
  var y_bottom = y_world * 1 + minimap.height / zoomlevel / 2;
  ctx_minimap_cursor.clearRect(0, 0, minimap_cursor.width, minimap_cursor.height);
  if (x_world < x_left || x_world > x_right || y_world < y_top || y_world > y_bottom) return;
  var xoff_c = x_world - x_left;
  var yoff_c = y_world - y_top;
  ctx_minimap_cursor.beginPath();
  ctx_minimap_cursor.lineWidth = zoomlevel / 6;
  ctx_minimap_cursor.strokeStyle = "#ff1bfc";
  ctx_minimap_cursor.rect(zoomlevel * xoff_c, zoomlevel * yoff_c, zoomlevel, zoomlevel);
  ctx_minimap_cursor.stroke();
}

function drawCircle() {
  var ctx = circle.getContext("2d");
  ctx.setTransform(circle.width/(circle_size*2), 0, 0, circle.height/(circle_size*2), 0, 0); //why?
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.strokeStyle = "#ff1bfc";
  /*
  ctx.moveTo(0,           circle_size); ctx.lineTo(circle_size-4,circle_size);
  ctx.moveTo(circle_size+4,circle_size); ctx.lineTo(circle_size*2+1,circle_size);
  ctx.moveTo(circle_size,0 );           ctx.lineTo(circle_size,circle_size-4);
  ctx.moveTo(circle_size,circle_size+4); ctx.lineTo(circle_size,circle_size*2+1);
  */
  ctx.arc(circle_size, circle_size, circle_size-0.5, 0, 2*Math.PI);
  ctx.stroke();
}

function getCenter() {
  var s = window.location.search.split(",");
  var cx = parseInt(s[0].split("=")[1]), cy = parseInt(s[1]);
  if(cx != centerx || cy != centery) paintcount = diffcount = minimum_y = maximum_y = 0; //user panned
  centerx = cx; centery = cy;
  //console.log("center: ", centerx, centery);
  loadTemplates();
}

window.addEventListener('keydown', function(e) {
  switch(e.keyCode) {//e.key is too national
    case 13: //Enter: captcha Send
      document.getElementsByClassName("MuiButton-text")[1].click();
      listTemplates
      listTemplates()
      break;
    case 32: //space
      toggleShow();
      if(toggle_show) {
        window.cachebreaker++;
        console.log("cachebreaker = ",cachebreaker);
        updateloop();
      }
      mymousemove();
      break;
    case 81: clickColor(1); break; //black is 1
    case 87: clickColor(0); break; //dark gray is 0
    case 69: clickColor(2); break;
    case 82: clickColor(3); break;
    case 84: clickColor(4); break;
    case 89: clickColor(5); break;
    case 85: clickColor(6); break;
    case 73: clickColor(7); break;
    case 79: clickColor(8); break;
    case 80: clickColor(9); break;
    case 221: clickColor(10); break;
    case 65: clickColor(11); break;
    case 83: clickColor(12); break;
    case 68: clickColor(13); break;
    case 70: clickColor(14); break;
    case 71: clickColor(15); break;
    case 107: //numpad +
      zooming_in = true;
      zooming_out = false;
      zoomIn();
      zooming_in = false;
      break;
    case 109: //numpad -
      zooming_out = true;
      zooming_in = false;
      zoomOut();
      zooming_out = false;
      break;
    case 88: //x: hide more elements
      var UIDiv = document.getElementById("upperCanvas").nextElementSibling;
      var menu = UIDiv.childNodes[4];
      var playercount = UIDiv.childNodes[3].childNodes[0];
      var coords = playercount.nextElementSibling;
      if(menu.style.display != "none") {
        menu.style.display = "none";
      } else if(playercount.style.display != "none"){ //hide counter
        playercount.style.display = "none";
      } else {
        coords.style.display = "none";
      }
      break;
    case 86: //Verify
      botStartStop(false);
      verifying = !verifying;
      document.getElementById("minimap-title").innerText = verifying ? "Verifying paint at "+verify_x+", "+verify_y : vers;
      if(verifying) {
        console.log("Verifying paint at "+verify_x+", "+verify_y+". Check it in another proxy tab!");
        paintcount = diffcount = 0;
      } else {
        document.title = "baiano";
      }
      setStatus();
      break;
    case 66: //B: Bot
      verifying = false;
      if(botting) botting=false;
      else {
        botting = needed_templates.length ? needed_templates[0] : false;
        if(!botting) sound(0);
      }
      botcolor = false;
      botStartStop(botting);
      break;
    case 67: //C: Bot only current color
      verifying = false;
      if(botting) botting=false;
      else botting = needed_templates.length ? needed_templates[0] : false;
      botcolor = true;
      botStartStop(botting);
      break;
    /*case 38: //ArrowUp
      nudge(0,-1); break;
    case 40: //ArrowDown
      nudge(0,1); break;
    case 39: //ArrowRight
      nudge(1,0); break;
    case 37: //ArrowLeft
      nudge(-1,0); break;
    */
    case 77: //M: bot Mode
      if(botmode=="R") botmode="S";
      else botmode="R";
      setStatus();
      console.log("botmode",botmode);
      break;
    default:
      console.log("keydown", e.keyCode, e.key);
  }
});

function botStartStop(set_botting) {
  botting = set_botting;
  if(botting) {
    var ctx_botcanvas;
    //sound(1);
    paintcount = diffcount = minimum_y = maximum_y = 0;
    var m = botcolor ? " (Only current color)" : "";
    console.log("Desenhando "+botting+m+". Do not pan or zoom! If you resize, you have to pan once after.");
    timerDiv.innerHtml = "0";
    botcanvas = document.getElementById("botcanvas");
    botcanvas.width  = template_list[botting].width;
    botcanvas.height = template_list[botting].height;
    ctx_botcanvas = botcanvas.getContext("2d");
    if(!image_list[botting]) loadImage(botting);
    if(!image_list[botting]) {
      botStartStop(false);
      console.log("failed: loadImage("+botting+")");
      return;
    }
    ctx_botcanvas.drawImage(image_list[botting], 0, 0);
    ctx_gameWindow = gameWindow.getContext("2d");
    botjobactive = false;
    botpixels = ctx_botcanvas.getImageData(0, 0, template_list[botting].width, template_list[botting].height).data; //r,g,b,a, r,g,b,a...
    ctx_botcanvas.clearRect(0, 0, template_list[botting].width, template_list[botting].height);
    delete(ctx_botcanvas);
    if(!botpixels.length) botting = false;
    setStatus();
  } else {
    document.title = "diperobot";
    setStatus();
    delete(botpixels);
    botjobactive = false;
  }
}

function setStatus() {
  var tit = document.getElementById("minimap-title");
  if(verifying) {
    tit.innerText = "Verifying paint at "+verify_x+", "+verify_y;
    circle.style.display="none";
  } else if(botting) {
    tit.innerText = botting ? "Botting"+(botcolor ? ":c" : "")+" "+botmode+" "+botting : "ERROR";
    circle.style.display="block";
  } else {
    tit.innerText = vers;
    circle.style.display="none";
  }
}

function botJob() {
  if((botting === false && verifying === false)|| botjobactive || timeToPaint() > 0) return;
  botjobactive = true;
  if(diffcount == 0) diffX = diffY = 0;
  var c;
  var dh = document.documentElement.clientHeight;
  var dw = document.documentElement.clientWidth;
  if(verifying) { //Paint a pixel to check in another proxy tab
    document.title = "Verifying";
    worldPosToWindow(verify_x + diffX, verify_y + diffY, false); //sets pos
    if(diffcount == 0) getDiff(verify_x, verify_y); //modifies pos
    if(gamezoom<4) {
      sound(0);
      console.log("Zoom must be at least 4");
      window.setTimeout(botjobend, 2000);
      return;
    }
    c = getRandomInt(0,15);
    console.log("Verify: Paint "+c+" "+pos.x+","+pos.y);
    window.clickColor(c);
    circle.style.left = (pos.x-circle_size)+"px";
    circle.style.top = (pos.y-circle_size)+"px";
    paint(pos.x,pos.y);
    window.setTimeout(botjobend, 2500);
    return;
  }
  document.title = "AF: "+botting;
  var xr, c_tpl, tpl = template_list[botting];
  var tested=0, time1 = Date.now();
  var xMax = botmode=="R" ? tpl.width/3+1 : tpl.width;
  for (var y = minimum_y; y < tpl.height; y++) {
    if(maximum_y && y > maximum_y) break;
    var yr = y; //Math.floor(Math.random() * tpl.height);
    for (var x = 0; x < xMax; x++) {
      if(y<minimum_y) continue;
      if(botmode=="R") xr = Math.floor(Math.random() * tpl.width);
      else xr = x;
      var pxi = yr*tpl.width*4 + xr*4;
      if(!botpixels[pxi+3]) continue; //transparent
      //Swapped ids: c for darkgray is 0, black is 1
      //c_tpl = Colors.getColorIdFromRGB([botpixels[pxi],botpixels[pxi+1],botpixels[pxi+2]]);
      try { c_tpl = colorid[botpixels[pxi]][botpixels[pxi+1]][botpixels[pxi+2]] }
      catch(e) { c_tpl = -1 }
      if(c_tpl < 0) {
        console.log("Your image contains colors outside the palette at "+xr+","+yr+": ["+botpixels[pxi]+","+botpixels[pxi+1]+","+botpixels[pxi+2]+"]. Use exact, and png format");
        continue;
      }
      if(botcolor && currentcolor != c_tpl) continue;
      worldPosToWindow(tpl.x + xr + diffX, tpl.y + yr + diffY, false);  //sets pos
      if(diffcount == 0) {
        getDiff(tpl.x + xr, tpl.y + yr); //modifies pos
        if(Math.abs(diffX) > 3 || Math.abs(diffY) > 3) {
          sound(0);
          console.log("Coordinate error too big. Please pan. Or don't start bot immediately after a pan.");
          botStartStop(false);
          return;
        }
      }
      if(gamezoom<4 || c_tpl==undefined) { //too small
        sound(0);
        console.log(c_tpl==undefined?"c_tpl not set":"Zoom must be at least 4");
        botStartStop(false);
        return;
      }
      if(pos.y<-4) minimum_y = y+1; //optimize: skip pixels off screen
      if(pos.y>dh+4) maximum_y = y;
      if(pos.x>dw) continue;
      tested++;
      var p = ctx_gameWindow.getImageData(pos.x, pos.y, 1, 1).data;
      if(p[3] && (p[0] != botpixels[pxi] || p[1] !=botpixels[pxi+1] || p[2] != botpixels[pxi+2])) {
        c = Colors.getColorIdFromRGB([p[0],p[1],p[2]]);
        console.log(tpl.x + xr, tpl.y + yr, "Paint "+c_tpl+ " was "+c+". Tested: "+tested+" in "+(Date.now()-time1)+" ms.");
        if(c_tpl != currentcolor) window.clickColor(c_tpl);
        circle.style.left = (pos.x-circle_size)+"px";
        circle.style.top = (pos.y-circle_size)+"px";
        //make sure we don't click too fast
        if(Date.now()-time1 < minDelay_ms) window.setTimeout(paintDelayed, getRandomInt(minDelay_ms, minDelay_ms*2));
        else paint(pos.x,pos.y);
        window.setTimeout(botjobend, 800);
        return;
      }
    }
  }
  console.log("No paint. Tested: "+tested+" in "+(Date.now()-time1)+" ms.");
  if(!tested) {
    console.log("!tested",tpl.height, currentcolor, c_tpl);
  }
  botjobactive = false;
}

function botjobend() {
  botjobactive = false;
}

function paintDelayed() {
  paint(pos.x,pos.y);
}

function getDiff(x, y) {
  var e = new MouseEvent("mousemove", {
    clientX: pos.x, clientY:pos.y, bubbles:true});
  botEvent = true; gameWindow.dispatchEvent(e); botEvent = false;
  var coordsXY = coorDOM.innerHTML.split(/\s?[xy:]+/);
  diffX = x - parseInt(coordsXY[1]);
  diffY = y - parseInt(coordsXY[2]);
  console.log("getDiff", x, y, "::", diffX, diffY);
  if(diffX!=0 || diffY!=0) {
    worldPosToWindow(x + diffX, y + diffY, true); //set pos again
    /*  //check, should be 0,0
    e = new MouseEvent("mousemove", {
      clientX: pos.x, clientY:pos.y, bubbles:true});
    botEvent = true; gameWindow.dispatchEvent(e); botEvent = false;
    coordsXY = coorDOM.innerHTML.split(/\s?[xy:]+/);
    console.log(" getDiff2 ::", x - parseInt(coordsXY[1]), y - parseInt(coordsXY[2]), " ##############################");
    */
  }
  diffcount++;
}

function worldPosToWindow(x,y, redo) { //sets pos
  if(!redo) {
    //Using coords from URL, which is DELAYED 1-2s
    var s = window.location.search.split(",");
    gamezoom = s.length>2 ? parseInt(s[2]) : 1;
    var cx = parseInt(s[0].split("=")[1]), cy = parseInt(s[1]);
    if(cx != centerx || cy != centery) paintcount = diffcount = minimum_y = maximum_y = 0; //user panned
    centerx = cx; centery = cy;
  }
  var dw = document.documentElement.clientWidth;
  var dh = document.documentElement.clientHeight;
  var tweak = Math.floor(gamezoom/2 + 0.95);
  var windowx = (x - centerx)*gamezoom + tweak + Math.floor(dw/2);
  var windowy = (y - centery)*gamezoom + tweak + Math.floor(dh/2);
  //if(gamezoom<2) return; paint(windowx,windowy);
  pos.x = windowx; pos.y = windowy;
}

/*function windowPosToWorld(x,y) {}*/

function paint(windowx,windowy) {
  var e, d = 0;
  if(paintcount++ % 20 == 0 && Date.now() - last_mousemove > 35) {
    e = new MouseEvent("mousedown", {clientX:windowx, clientY: windowy, bubbles:true});
    gameWindow.dispatchEvent(e);
    d = 12;
  }
  e = new MouseEvent("mouseup", {clientX:windowx, clientY:windowy, bubbles:true});
  if(d) setTimeout(function(){
    botEvent = true; gameWindow.dispatchEvent(e); botEvent = false;
  },d);
  else {
    botEvent = true; gameWindow.dispatchEvent(e); botEvent = false;
  }
}

function nudge(x,y) { //not working
  var e, m = 8;
  e = new MouseEvent("mousedown", {
    clientX: 16, clientY:16, bubbles:true});
  gameWindow.dispatchEvent(e);
  setTimeout(function(){
    e = new MouseEvent("mousemove", {
      clientX: 16 + x*m, clientY:16 + y*m, bubbles:true});
    botEvent = true; gameWindow.dispatchEvent(e); botEvent = false;
  },80);
  setTimeout(function(){
    e = new MouseEvent("mousemove", {
      clientX: 16 + x*m*2, clientY:16 + y*m, bubbles:true});
    botEvent = true; gameWindow.dispatchEvent(e); botEvent = false;
  },120);
  setTimeout(function(){
    e = new MouseEvent("mouseup", {
      clientX: 16 + x*m*2, clientY:16 + y*m*2, bubbles:true});
    botEvent = true; gameWindow.dispatchEvent(e); botEvent = false;
  },200);
}

function timeToPaint() { //0 means ready
  //Captcha open?
  var e = document.getElementsByClassName("post")[0];
  if(e && e.nextSibling && e.nextSibling.style.visibility == "visible") {
    if(!capsound) new Audio("http://botaqua1155.freevar.com/ding.mp3").play();
    document.title = "CAPTCHA...";
    capsound = 1;
    paintcount = 0;
    return 999;
  }
  capsound = 0;
  //timer
  return parseInt(timerDiv.innerHTML);
}

window.clickColor = (c) => {
  //Weirdness: c for darkgray is 0, black is 1
  if(c < 2) c = c^1; //XOR
  var pal = document.getElementsByClassName("palette-container")[0].childNodes[0];
  //https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/MouseEvent
  var e = new MouseEvent("click", {
    offsetX: pal.offsetLeft+4,
    offsetY: pal.offsetTop+4,
    bubbles: true
  });
  var target = pal.childNodes[parseInt(c/8)].childNodes[c % 8];
  target.dispatchEvent(e);
}

function sound(i) { //0,1
  if(!sounds[i]) sounds[i] = new Audio("client/res/sfx/"+(i==0?"bip1.mp3":"bip2.mp3"));
  if(sounds[i]) sounds[i].play();
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

window.setCookie = function(name,value) { //you can supply "minutes" as 3rd arg.
  var argv = setCookie.arguments;
  var argc = setCookie.arguments.length;
  var minutes = (argc > 2) ? argv[2] : 720*24*60; //default 720 days
  var date = new Date();
  date.setTime(date.getTime()+(minutes*60*1000));
  var expires = "; expires="+date.toGMTString();
  document.cookie = name+"="+value+expires+"; path=/";
}

function getCookie(name) {
  var value = "; " + document.cookie;
  var parts = value.split("; " + name + "=");
  if (parts.length == 2) return parts.pop().split(";").shift();
}

/* Pixelzone stuff you can use:
Colors.colorsPalette[0..15][0..2]
  Weirdness: darkgray is 0, black is 1
Colors.getColorIdFromRGB([0,0,230])  exact only
Colors.getColorStrFromId(15) = "rgb(0, 0, 230)"
local storage: lastPaletteColor
*/