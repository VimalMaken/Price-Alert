//import Chrome, Edge, Firefox, and Safari as text
//Turn them into Arrays
//Merge, Randomize
//Export as JSON
const fs = require('fs');
const chromeFile = fs.readFileSync('./Chrome.txt').toString('utf-8').trim();
const firefoxFile = fs.readFileSync('./Firefox.txt').toString('utf-8').trim();
const edgeFile = fs.readFileSync('./Edge.txt').toString('utf-8').trim();
const safariFile = fs.readFileSync('./Safari.txt').toString('utf-8').trim();
const chrome = chromeFile.split("\n")
const firefox = firefoxFile.split('\n');
const edge = edgeFile.split('\n');
const safari = safariFile.split('\n');
let merge = [...chrome, ...firefox, ...edge, ...safari];
merge = shuffle(merge);
console.log(merge);
let jsonObject = JSON.stringify(merge, null, 2);
fs.writeFile('./user_agent.json', jsonObject, (err) => {
    if (err) throw err;
});



function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
  }