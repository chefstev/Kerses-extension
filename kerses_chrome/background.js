// Background.js is the middleman of the front end
// It handles the sending of urls to the Kerses server
// and sending the responses to the client scripts

KERSES_URL = "https://kerses.com/api/";

// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
function parseUri (str) {
	var	o   = parseUri.options,
		m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i   = 14;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
};

parseUri.options = {
	strictMode: false,
	key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
	q:   {
		name:   "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	}
};

// Send a message to the content-script to load the
// returned article data into the page
function sendCSResponse(data) {
  console.log("Sending data to webpage handler")
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, data, function(response) {
      console.log(response);
    });
  });
}

// Handles the "cleaning" of the url. This means that for certain
// sites we choose to do special processes for speed plus overall
// detecting redirects and getting the final url of the document
// Also makes sure that the link is legitimate and will not give a
// 404
function cleanUrl(url, depth) {
  // Put stops on how deep to recurse in urls to prevent loops
  if (depth == 0) {
    console.log("Cycle detected for: " + url + " -> failed to query");
    return;
  }
  var parsed_uri = parseUri(url);
  // Facebook wraps all urls in their own url
  if (parsed_uri.host === "l.facebook.com") {
    cleanUrl(decodeURIComponent(parsed_uri.queryKey.u).match(/.+?(?=\?)/)[0], depth - 1);

  } else if (parsed_uri.host === "t.co") {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        cleanUrl(xhttp.responseText.match(/<title>(.*)<\/title>/)[1], depth - 1);
      }
    };
    xhttp.open("GET", url, true);
    xhttp.send();
  } else {
    // Make head request
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        if (this.status < 300 && this.status >= 200) {
          // If we are given a url make sure that it is a valid
          // site and if it redirects somewhere else get that url
          if (this.responseURL === url) {
            queryKerses(url);
          } else {
            cleanUrl(this.responseURL, depth - 1);
          }
        } else {
          // If the link isn't valid just return not an article
          sendCSResponse({"is_article": false})
        }
    };

    xhr.open("HEAD", url, true);
    xhr.send();
  }
}

// Converts an image to base64 so we don't have content source issues
function toDataURL(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    var reader = new FileReader();
    reader.onloadend = function() {
      callback(reader.result);
    }
    reader.readAsDataURL(xhr.response);
  };
  xhr.open('GET', url);
  xhr.responseType = 'blob';
  xhr.send();
}

// Send a request to the kerses server to get the article information
// for the url that the user wants to look up
function queryKerses(url) {
  console.log("Requesting url from kerses: " + url);
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
      var resp = JSON.parse(this.response);
      // If there is an image base64 encode it
      if (resp.image) {
        toDataURL(resp.image, function(data) {
          resp.image = data;
          sendCSResponse(resp);
        })
      } else {
        sendCSResponse(resp);
      }
    }
  }
  xhr.open("POST", KERSES_URL + "v1/process_url/", true);
  xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  var data = {'url': url};
  xhr.send(JSON.stringify(data));
}

// Starts the process of building the text box and validating the
// requested url to get information about the article
build_box = function(url) {
	sendCSResponse({'build_box': true})
	cleanUrl(url, 5);
}

// Inject the js into the page that will handle the creation
// of the text box
get_link = function(url) {
  console.log("Checking url: " + url.linkUrl);
  // Load the js into the page dynamically
  chrome.tabs.executeScript({
    file: 'kerses.js'
  }, function(res) {
			build_box(url.linkUrl);
	});
}

// Same as get_link except it sends the current page url
// that the user asks for
get_page = function(page) {
  console.log("Checking url: " + page.pageUrl);
  // Load the js into the page dynamically
  chrome.tabs.executeScript({
    file: 'kerses.js'
  }, function(res) {
		  build_box(page.pageUrl);
	});
}

/* Basic function that the contextmenu calls to set it up with the url
   - > sends CSResponse to context script to build the loader
   - > calls clean url function
      -> clean url checks against our list of urls that redirect
        -> recursively call clean url again with our cleaned url
      -> if it does not match any of them then the else branch calls
         the post to kerses
         -> should also keep calling clean url if the result of requesting the url leads
            to a new url (put limits on obviously)

*/

// Add Kerses to right-click context menu
chrome.contextMenus.create({
 title: "Look up article link",
 contexts:["link"],  // ContextType
 onclick: get_link // A callback function
});

// Add Kerses for current page to right-click context menu
chrome.contextMenus.create({
 title: "Look up this page",
 contexts:["page"],  // ContextType
 onclick: get_page // A callback function
});
