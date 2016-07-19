// geowiki.js

function GeoWiki() {
   this.results = new Object();
   this.onPageAdded = function(page){};
}

GeoWiki.prototype.addPage = function(id, page) {
   if (typeof this.results[id] == "undefined") {
      // new page
      this.results[id] = new Object();
      this.results[id].page = page;
      this.results[id].id = id;
      
      // build html description
      var desc = "";
      if (typeof page.thumbnail !== "undefined")
         desc += "<img style=\"float:left; margin: 0 1em 1em 0; height: " + page.thumbnail.height + "px;\" src=\"" + page.thumbnail.source + "\"/>" + 
                 "<p style=\"height: " + page.thumbnail.height + "px;\">";
      else
         desc += "<p>"
      if (typeof page.terms !== "undefined")
         desc += page.terms.description[0];
      desc += "</p><p><a href=\"//de.wikipedia.org/wiki/" + page.title + "\" target=\"_blank\">Quelle</a></p>";
      
      this.results[id].description = desc;
      this.onPageAdded(this.results[id])
   }
}

GeoWiki.prototype.update = function(longitude, latitude, radius) {
   if (typeof radius == "undefined")
      radius = 10000;
   var self = this;
   $.ajax( {
      url: "https://de.wikipedia.org/w/api.php",
      jsonp: "callback", 
      dataType: 'jsonp', 
      data: { 
        action: "query",
        format: "json",
        colimit: 50,
        prop: "coordinates|pageimages|pageterms",
        piprop: "thumbnail",
        pithumbsize: 144,
        pilimit: 50,
        wbptterms: "description",
        generator: "geosearch",
        ggscoord: latitude + "|" + longitude,
        ggsradius: radius,
        ggslimit: 50
      },
      xhrFields: { withCredentials: true },
      success: function(response) {
         for (var i in response.query.pages) {
            self.addPage(i, response.query.pages[i]);
         }
      }
   });
}