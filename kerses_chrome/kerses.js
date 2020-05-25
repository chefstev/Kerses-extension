// Kerses main js file is in charge of interacting with the DOM
// of the webpage. It responds to a message from our background
// script to create the text box that is displayed on the screen

/*!
 * Sanitize and encode all HTML in a user-submitted string
 * (c) 2018 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param  {String} str  The user-submitted string
 * @return {String} str  The sanitized string
 */
var sanitizeHTML = function (str) {
	var temp = document.createElement('div');
	temp.textContent = str;
	return temp.innerHTML;
};

function formatDate(dateString) {
	var d = new Date(dateString);
	const year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d)
	const month = new Intl.DateTimeFormat('en', { month: 'short' }).format(d)
	const day = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d)

	return `${day} ${month} ${year}`
}

function addNonArticleData(kersesBox) {
	template =
	`<h4 class="kerses-non-article">
		An article was not detected at this link
	</h4>
	<img class="kerses-logo" src=${chrome.runtime.getURL("kerses_logo_mini_128.png")}>`
	kersesBox.innerHTML = template
}

// Dynamically add image
function addImage(articleData) {
	if (articleData.image.localeCompare("")) {
		return `<img class="kerses-top-image" src=${sanitizeHTML(articleData.image)}>`;
	} else {
		return "";
	}
}

// Dynamically adds similar articles
function addSimilar(similarArticles) {
	similarTemplate = "";
	for (i = 0; i < similarArticles.length; i++) {
		articleData = similarArticles[i];
		similarTemplate +=
		`<div class="kerses-similar">
			<a href="${sanitizeHTML(articleData.url)}" target="_blank" class="kerses-article-link">
				<h3 class="kerses-similar-title">${sanitizeHTML(articleData.title)}</h3>
			</a>
			<p class="kerses-similar-producer">${sanitizeHTML(articleData.site_name)} - ${formatDate(articleData.date_published)}</p>
		</div>`;
	}
	return similarTemplate;
}

// Builds the box dynamically using the given article data
function addArticleData(kersesBox, articleData) {
	template =
	`${addImage(articleData)}
	<div class="kerses-article">
		<a href="${sanitizeHTML(articleData.url)}" target="_blank" class="kerses-article-link">
			<h3 class="kerses kerses-article-title">${sanitizeHTML(articleData.title)}</h3>
		</a>
		<p class="kerses kerses-producer">
			<a href="${sanitizeHTML(articleData.site_root)}" target="_blank" class="kerses-producer-link">${sanitizeHTML(articleData.site_name)}</a> - ${formatDate(articleData.date_published)}
		</p>
		<div class="kerses-content-box">
			<p class="kerses-content">
				${sanitizeHTML(articleData.content)}
			</p>
		</div>
		<h3 class="kerses-related">Related Coverage</h3>
		<hr>
		<div class="kerses-similar-articles">
			<div class="kerses-similar-scroll-box">
				${addSimilar(articleData.similar)}
			</div>
		</div>`;
		kersesBox.innerHTML = template;
}

function addLoading(kersesBox) {
	template =
	`<!-- Credit to @tobiasahlin for the loading icon -->
	<div class="kerses-sk-chase">
		<div class="kerses-sk-chase-dot"></div>
		<div class="kerses-sk-chase-dot"></div>
		<div class="kerses-sk-chase-dot"></div>
		<div class="kerses-sk-chase-dot"></div>
		<div class="kerses-sk-chase-dot"></div>
		<div class="kerses-sk-chase-dot"></div>
	</div>
	<h4 class="kerses-loading">Querying Article</h4>`
	kersesBox.innerHTML = template
}

// Builds the main kerses box on the screen and creates the shadow elements
function buildKersesBox() {
	var kersesBox = document.createElement("div");
	kersesBox.setAttribute("class", "kerses");
	var shadow = kersesBox.attachShadow({mode: 'open'});
	var style = document.createElement("link");
	style.setAttribute("rel", "stylesheet");
	style.setAttribute("type", "text/css");
	style.setAttribute("href", chrome.runtime.getURL("kerses.css"));
	//style.setAttribute("href", "kerses.css");
	shadow.appendChild(style);

	// Create the inner box that contains the data
	var box = document.createElement("div");
	box.classList.add("kerses-box");

	// Create Button
	var button = document.createElement("button");
	button.classList.add("kerses-close");
	button.addEventListener("click", function() {
		document.body.removeChild(document.body.getElementsByClassName("kerses")[0]);
	})
	box.appendChild(button);

	// Create inner div
	var internals = document.createElement("div");
	internals.classList.add("kerses-internals");
	box.appendChild(internals)

	// Add the inital loading data
	addLoading(internals)

	shadow.appendChild(box);
	document.body.appendChild(kersesBox);
}

// class Kerses extends HTMLElement {
// 	constructor() {
// 		super();
//
// 		// Create Shadow root
// 		var shadow = this.attachShadow({mode: 'open'});
// 		// Create a main box
//
// 		//var style = document.createElement("style");
// 		var style = document.createElement("link")
// 		style.setAttribute("rel", "stylesheet");
// 		style.setAttribute("type", "text/css");
// 		style.setAttribute("href", "kerses.css")
//
// 		shadow.appendChild(style);
// 	}
// }
//
// customElements.define("kerses-box", Kerses);

// Listen for messages from background with article data
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
		var kerses_box = document.body.getElementsByClassName("kerses")
		if (request.build_box) {
			console.log("Building box")
			if (kerses_box.length == 0){
				buildKersesBox();
				sendResponse({farewell: "Kerses Box Created"})
			} else {
				addLoading(kerses_box[0].shadowRoot.lastChild.getElementsByClassName("kerses-internals")[0])
				sendResponse({farewell: "Kerses Box already exists"})
			}
		} else {
			if (kerses_box.length == 0) {
				return; // Box was removed
			}
			console.log("Adding data to box")
			internals = kerses_box[0].shadowRoot.lastChild.getElementsByClassName("kerses-internals")[0]
			if (request.is_article) {
				addArticleData(internals, request);
			} else {
				addNonArticleData(internals)
			}
			sendResponse({farewell: "Data Added"});
		}
  });
