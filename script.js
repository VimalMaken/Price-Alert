//Importing dependencies. Read up on each dependency to understand functionality.
const axios = require('axios'); //https://www.npmjs.com/package/axios
const cheerio = require('cheerio'); //https://www.npmjs.com/package/cheerio
const { WindowsBalloon } = require('node-notifier'); //https://www.npmjs.com/package/node-notifier
const open = require("open"); //https://www.npmjs.com/package/open

//Reading json files and outputting result as a JSON object.
//Keep a local version of the JSON as array because JSON won't be updated until server reboots
const fs = require('fs');
const db_data = fs.readFileSync('./data.json');
const db_ua = fs.readFileSync('./user_agent.json');
let data = JSON.parse(db_data);
let uaArray = JSON.parse(db_ua);
//randomize on start so user agent queue is always different on launch
uaArray = shuffle(uaArray);

//VARIABLES
const highSleep = 5000; //5 seconds
const mediumSleep = 600000 //10 minutes
const lowSleep = 21600000 //6 hours
let uaIndex = 0; //current position in uaArray

//Direct the queries to the proper functions
for(let item in data.in_progress){
    let site = '';
    
    //Determines which hostname the url has like 'Amazon'
    const url = new URL(data.in_progress[item].url);
    var hostname = url.hostname.split(".");
    site = hostname[1];

    switch (site){
        case 'amazon':
            fetchAmazon(url, item);
            break;
        case 'bestbuy':
            fetchBestBuy(url, item);
            break;          
        case 'canadacomputers':
            fetchCanadaComputers(url, item);
            break;
        case 'memoryexpress':
            fetchMemoryExpress(url, item);
            break;
        default:
            console.log('url not found in our database');
    }  
}

//SCRAPING & API FUNCTIONS
//Checks if it's the desired price
async function fetchAmazon(url, index){
    //Main case that the amazon item is of /dp/ case
    if(url.href.indexOf("/dp/") > -1) {
        // strip tracking parameters from amazon url
        let splitUrl = url.href.split("/dp/");
        let editedUrl = splitUrl[0].concat('/dp/').concat(splitUrl[1].substring(0,10));
        while(1){
            //Sleep at beginning so Amazon doesn't detect multiple requests really quickly
            await sleep(index);
            //Choosing a random user agent so amazon thinks the scraper is a browser
            let header = randomUA();
            let date = timestamp();
            //console.log(date, "FETCHING AMAZON NOW", index)
            let page;
            try {
                //Make get request for the page returning page info
                page = (await axios.get(editedUrl, {headers: header})).data;
                const $ = cheerio.load(page)
                //Find the deal price on the page
                let dealPrice = parseFloat($("#priceblock_dealprice").text().substring(5));
                if(dealPrice != "" && dealPrice <= data.in_progress[index].desiredPrice){
                    //There is a deal
                    completed(index);
                    break;
                }
            }
            catch (err) {
                console.log("ERROR URL", err.config);
            }
        }
    }
    //Edge case that the product link is of /gp/
    else if(url.href.indexOf("/gp/") > -1) {
        // strip tracking parameters from amazon url
        let splitUrl = url.href.split("/gp/offer-listing/");
        let editedUrl = splitUrl[0].concat('/gp/offer-listing/').concat(splitUrl[1].substring(0,10));
        while(1){
            //Sleep at beginning so Amazon doesn't detect multiple requests really quickly
            await sleep(index);
            //Choosing a random user agent so amazon thinks the scraper is a browser
            let header = randomUA();
            let date = timestamp();
            //console.log(date, "FETCHING AMAZON NOW", index)
            let page;
            try {
                 //Make get request for the page returning page info
                page = (await axios.get(editedUrl, {headers: header})).data;
                const $ = cheerio.load(page)
                //find all of the offer prices and shipping prices listed on the website
                let offerPrices = $(".olpOfferPrice");
                let shippingPrices = $(".olpShippingPrice");
                let finalPrice;
                for(let i in offerPrices){
                    //only calculate when it's a valid child element AKA has a valid price
                    if(Number.isInteger(parseInt(i))){
                        //Take out the CDN$ from the beginning of the pricetag to only have a number
                        let tempShip = shippingPrices[i].children[0].data.trim().split("CDN$ ")[1];
                        let tempOffer = offerPrices[i].children[0].data.trim().split("CDN$ ")[1];
                        //If the price is over $1,000, remove the comma
                        if(tempShip.includes(",")){
                            let temp_var = tempShip.split(",");
                            tempShip = temp_var[0].concat(temp_var[1]);
                        }
                        if(tempOffer.includes(",")){
                            let temp_var = tempOffer.split(",");
                            tempOffer = temp_var[0].concat(temp_var[1]);
                        }
                        //Total price of deal
                        let tempPrice = parseFloat(tempShip) + parseFloat(tempOffer);
                        //If this is the first price checked 
                        if(finalPrice === undefined){
                            finalPrice = tempPrice;
                        }
                        //If the currently calculated price is lower than the current final price
                        else if(tempPrice < finalPrice){
                            finalPrice = tempPrice;
                        }
                        //The calculated price is not lower than the current final price
                        else {
                            continue;
                        }
                    }     
                }
                if(finalPrice != "" && finalPrice <= data.in_progress[index].desiredPrice){
                    //There is a deal
                    completed(index);
                    break;
                }
            }
            catch (err) {
                console.log("ERROR URL", err.config);
            }
        }
    }
    else {
        console.log("Amazon scraper doesn't currently support this url")
    }
}

//Checks if it's the desired price and only if it's in stock online
async function fetchBestBuy(url, index){
    //Looking to see if it's in stock
    while(1){
        //Choosing a random user agent so best buy thinks the scraper is a browser
        let header = randomUA();
        let date = timestamp();
        //console.log(date, "FETCHING BEST BUY NOW", index)
        try {
            //Make get request for the page returning page info
            const page = (await axios.get(url.href, {headers: header})).data;
            const $ = cheerio.load(page)
            //Checks if the product page is out of stock. If it is, go straight to sleep
            let truthity = $(".container_3LC03").text().trim();
            if(truthity !== "Sold out online" && truthity !== "" && truthity.length < 1000) {
                console.log(date, "TRUTHITY:", index, "'" + truthity + "'");
            }
            if(truthity !== "Sold out online" && truthity !== "" && truthity.length < 1000){ 
                //Just looking to see if it's in stock
                if(data.in_progress[index].desiredPrice === data.in_progress[index].listedPrice){
                    completed(index);
                    break;
                }
                //Looking for a desired sale price
                else {
                    //Grab sale price
                    let str = $(".salePrice_kTFZ3").text().substring(1);
                    let splitPrice = str.substring(0, str.length - 2).split(",");
                    
                    let dealPrice = parseFloat(splitPrice[0].concat(splitPrice[1]));
                    if(dealPrice != "" && dealPrice <= data.in_progress[index].desiredPrice){
                        //There is a deal
                        completed(index);
                        break;
                    }
                }
            }
        }
        catch (err) {
            console.log("ERROR URL", err.config);
        }
        
        //Sleeps to avoid being detected as a scraper and save on CPU utilization
        await sleep(index);
    }
}

//Checks if it's the desired price and only if it's in stock online
async function fetchCanadaComputers(url, index){
    while(1){
        //Choosing a random user agent so canada computers thinks the scraper is a browser
        let header = randomUA();
        let date = timestamp();
        //console.log(date, "FETCHING CANADA COMPUTERS NOW", index)
        try{
            //Make get request for the page returning page info
            const page = (await axios.get(url.href, {headers: header})).data;  
            const $ = cheerio.load(page);
            let truthity = $(".pi-prod-availability span:nth-child(2)").text().trim();
            //This means the product is in stock
            //console.log("TRUTHITY:", truthity);
            if(truthity !== "Not Available Online" && truthity !== "") {
                console.log(date, "TRUTHITY:", index, "'" + truthity + "'");
            }
            if(truthity !== "Not Available Online" && truthity !== ""){
                //Just looking to see if it's in stock
                if(data.in_progress[index].desiredPrice === data.in_progress[index].listedPrice){
                    completed(index);
                    break;
                }
                //Looking for a desired sale price
                else {
                    //Gets the deal price
                    let dealPrice = parseFloat($(".text-red").first().first().text().trim().substring(1));
                    if(dealPrice != "" && dealPrice <= data.in_progress[index].desiredPrice){
                        //There is a deal
                        completed(index);
                        break;
                    }
                }
            }
        }
        catch (err){
            console.log("ERROR URL", err.config);
        }
        
        //Sleeps to avoid being detected as a scraper and save on CPU utilization
        await sleep(index);
    }
}

//Checks if it's the desired price and only if it's in stock online
async function fetchMemoryExpress(url, index){
    while(1){
        //Choosing a random user agent so memory express thinks the scraper is a browser
        let header = randomUA();
        let date = timestamp();
        //console.log(date, "FETCHING MEMORY EXPRESS NOW", index)
        //Make get request for the page returning page info
        try {
            const page = (await axios.get(url.href, {headers: header})).data;  
            const $ = cheerio.load(page);
            //Checks stock online
            let truthity = $(".c-capr-inventory-store__availability").last().text().trim();
            //This means the product is in stock
            //console.log("TRUTHITY:", truthity);
            if(truthity !== "Out of Stock") {
                console.log(date, "TRUTHITY:", index, truthity);
            }
            if(truthity !== "Out of Stock" && truthity !== ""){
                //Just looking to see if it's in stock
                if(data.in_progress[index].desiredPrice === data.in_progress[index].listedPrice){
                    completed(index);
                    break;
                }
                //Looking for a desired sale price
                else {
                    //Gets the deal price
                    let dealPrice = parseFloat($(".c-capr-pricing__grand-total").text().trim().substring(5));
                    if(dealPrice != "" && dealPrice <= data.in_progress[index].desiredPrice){
                        //There is a deal
                        completed(index);
                        break;
                    }
                }
            }
        }
        catch (err) {
            console.log("ERROR URL", err.config);
        }
        //Sleeps to avoid being detected as a scraper and save on CPU utilization
        await sleep(index);
    }
}

//UTILITY FUNCTIONS
function sleep(index) {
    //range to be from 0.5 to 1.5
    let multiplier = Math.random() + 0.5;
    //Different sleep time depending on priority
    switch (data.in_progress[index].priority){
        case 'low':
            return new Promise((resolve) => {
                setTimeout(resolve, multiplier*lowSleep);
            });
        case 'medium':
            return new Promise((resolve) => {
                setTimeout(resolve, multiplier*mediumSleep);
            });     
        case 'high':
            return new Promise((resolve) => {
                setTimeout(resolve, multiplier*highSleep);
            });
        default:
            console.log('priority not found in our database');
    }
}

function timestamp(){
    const date = new Date();
    return date.toTimeString().slice(0,8);
}

function randomUA(){
    //returns the next user agent in the queue
    let returnItem =
    { 
        'User-Agent': uaArray[uaIndex]
    };
    if(uaIndex != uaArray.length - 1){
        uaIndex++;
    }
    //queue is done. reset the queue and reshuffle
    else {
        uaIndex = 0;
        uaArray = shuffle(uaArray);
    }

    return returnItem;
}

//Fisher-Yates Shuffle Algorithm to randomize an array
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

var notifier = new WindowsBalloon({
    withFallback: false, // Try Windows Toast and Growl first?
    customPath: undefined // Relative/Absolute path if you want to use your fork of notifu
});

function completed(index){
    console.log("DEAL HAS BEEN FOUND!", index);
    //Notify the computer when then deal was found and open the url in the default browser
    notifier.notify(
            {
                title: 'Deal alert',
                message: 'A price drop was detected',
                time: 5000,
                sound: true, // Only Notification Center or Windows Toasters
                wait: false,
                type: 'info'
            },
            function (err, response, metadata) {
                open(data.in_progress[index].url)
            }
    );
    //Move the item from the in progress section of the json file to the completed
    let tempData = data;
    let id = data.in_progress[index].id;
    for(let i in tempData.in_progress){
        if(tempData.in_progress[i].id === id){
            let spliced = tempData.in_progress.splice(i,1);
            tempData.completed.push(spliced);
            const writeData = JSON.stringify(tempData, null, 2); 
            fs.writeFile('./data.json', writeData, (err) => {
                if (err) throw err;
            });
            break;
        }
    }
    data = JSON.parse(db_data);
}

//Sometimes you will get "" as a response because the page didnt load fast enough
