var d = new Date();
d.setDate(d.getDate() - 1);
var date = d.toISOString().split('T')[0];
var env = 'test';
var https = require('https');
var openStatesQuery = createOpenStatesQuery(date);
var Twitter = require('twitter');
var twitter = new Twitter({
  consumer_key: process.env.api_key,
  consumer_secret: process.env.api_secret_key,
  access_token_key: process.env.access_token,
  access_token_secret: process.env.access_token_secret,
});
var url = 'openstates.org';

function getIt(query, bills) {
  var options = {
    headers: {'X-API-KEY': process.env.openStatesKey},
    host: url,
    path: `/graphql/?query=${query}`,
  };
  var req = https.get(options, function (res) {
    console.log('STATUS: ' + res.statusCode);
    console.log('HEADERS: ' + JSON.stringify(res.headers));
    var bodyChunks = [];
    res
      .on('data', function (chunk) {
        bodyChunks.push(chunk);
      })
      .on('end', function () {
        var body = Buffer.concat(bodyChunks);
        var parsedBody = JSON.parse(body);
        var hasNextPage = parsedBody.data.search.pageInfo.hasNextPage;
        var endCursor = parsedBody.data.search.pageInfo.endCursor;
        var responseData = parsedBody.data.search.edges;
        for (i = 0;i < responseData.length;i++) {
          bill = createBillObject(responseData[i]);
          bills.push(bill);
        }
        if (hasNextPage) {
          var newQuery = createOpenStatesQuery(date, endCursor);
          getIt(newQuery, bills);
        } else {
          startTweeting(bills);
        }
      });
  });
  req.on('error', function (e) {
    console.log('ERROR: ' + e.message);
  });
}

function startTweeting(bills, testing = false) {
  var limit = 0;
  if (bills.length === 0) {
    console.log('No bills found today');
    return false;
  } else if (bills.length > 300) {
    tweet('There were over 300 bills with activity yesterday, which exceeds our rate limit for sending tweets. Please check https://openstates.org/co/ for more details');
    limit = 299;
  } else {
    limit = bills.length;
  }
  for (i = 0;i < limit;i++) {
    var tweetText = createTweetText(bills[i]);
    if (testing) {
      return bills;
    } else {
      tweet(tweetText);
    }
  }
}

function tweet(status) {
  if (env === 'production') {
    twitter
      .post('statuses/update', {status: status})
      .then(function (tweet) {
        console.log(tweet);
      })
      .catch(function (error) {
        console.log(error);
      });
  } else {
    console.log(status);
  }
}

function createOpenStatesQuery(date, cursor = null) {
  var query = `
        {
            search: bills(first:100, after:"${
    cursor ? cursor : ''
    }", jurisdiction: "Colorado", actionSince: "${date}") {
                edges {
                    node {
                        id,
                        title,
                        identifier,
                        openstatesUrl,
                        actions {
                            description
                            date
                        }
                    }
                }
                pageInfo {
                    hasNextPage
                    hasPreviousPage
                    endCursor
                    startCursor
                }
            }
        }
    `;
  return encodeURIComponent(query);
}

function createBillObject(data) {
  bill = {
    identifier: data.node.identifier,
    title: data.node.title,
    latestAction: data.node.actions[0].description,
    latestActionDate: data.node.actions[0].date.split('T')[0],
    openstatesUrl: data.node.openstatesUrl,
  };
  return bill;
}

function createTweetText(bill) {
  var tweetText = '';
  var tweetBody = `Colorado ${bill.identifier}: ${bill.title}. On ${
    bill.latestActionDate
    }, the following action was taken: ${bill.latestAction}. `;
  var readMore = bill.openstatesUrl
    ? 'Read more at: ' + bill.openstatesUrl.toString()
    : '';
    if ((tweetBody + readMore).length <= 280) {
      tweetText = tweetBody + readMore;
    } else if (tweetBody.length <= 280) {
      tweetText = tweetBody;
    } else {
      tweetText = `There was action on Colorado ${bill.identifier}, but it was too long to tweet.`;
    }
  return tweetText;
}

exports.handler = function (event, context, callback) {
  console.log(event);
  console.log(context);
  env = 'production';
  getIt(openStatesQuery, []);
  callback(null, 'Success from lambda');
};

exports.testCreateOpenStatesQuery = function (date, cursor) {
  return createOpenStatesQuery(date, cursor).raw;
};

exports.testCreateBillObject = function (data) {
  return createBillObject(data);
};

exports.testStartTweeting = function (bills) {
  return startTweeting(bills, true);
};

exports.testCreateTweetText = function(bill) {
  return createTweetText(bill);
};

if (process.argv[2] === 'local') {
  getIt(openStatesQuery, []);
}
