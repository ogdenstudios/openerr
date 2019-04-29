// Load dependencies and set up constants 
const axios = require('axios');
const secrets = require("./secrets.json");
const url = "https://openstates.org/graphql";
var today = new Date();

// For testing purposes. TODO: make sure we use the correct date
var date = today.getFullYear()+'-0'+(today.getMonth()+1)+'-'+(today.getDate()-8);

// TODO: use this one for the date.
// var date = today.getFullYear()+'-0'+(today.getMonth()+1)+'-'+today.getDate();

var openStatesQuery = '{search: bills(first: 100, jurisdiction: "Colorado", actionSince: "'+ date +'") {edges {node {id, title, actions{description, date}}}}}'

// Set the API Key header for all requests
axios.defaults.headers.common['X-API-KEY'] = secrets.openStatesKey;

async function getIt() {
    try {
        const response = await axios.get(url, {params: { query: openStatesQuery }});
        process(response.data);
    } catch (error) {
        console.log("error :(");
        console.error(error);
    }
}

getIt();

function process(data){
    responseData = data.data.search.edges;
    for (i=0;i<responseData.length;i++) {
        var title = responseData[i].node.title;
        console.log(title);
        var actions = responseData[i].node.actions;
        for (j=0;j<actions.length;j++){
            console.log(actions[j]);
        }
    }
}