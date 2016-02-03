import L from 'leaflet';
import {cors} from '../Support';


export var RasterLayer = L.Layer.extend({

  options: {
    opacity: 1,
    position: 'front',
    f: 'image',
    useCors: cors,
    attribution: null,
    interactive: false,
    alt: ''
  },

  onAdd: function (map) {
    this._update = L.Util.throttle(this._update, this.options.updateInterval, this);

    map.on('moveend', this._update, this);

    // if we had an image loaded and it matches the
    // current bounds show the image otherwise remove it
    if (this._currentImage && this._currentImage._bounds.equals(this._map.getBounds())) {
      map.addLayer(this._currentImage);
    } else if (this._currentImage) {
      this._map.removeLayer(this._currentImage);
      this._currentImage = null;
    }

    this._update();

    if (this._popup) {
      this._map.on('click', this._getPopupData, this);
      this._map.on('dblclick', this._resetPopupState, this);
    }
  },

  onRemove: function (map) {
    if (this._currentImage) {
      this._map.removeLayer(this._currentImage);
    }

    if (this._popup) {
      this._map.off('click', this._getPopupData, this);
      this._map.off('dblclick', this._resetPopupState, this);
    }

    this._map.off('moveend', this._update, this);
  },

  getEvents: function () {
    return {
      moveend: this._update
    };
  },

  bindPopup: function (fn, popupOptions) {
    this._shouldRenderPopup = false;
    this._lastClick = false;
    this._popup = L.popup(popupOptions);
    this._popupFunction = fn;
    if (this._map) {
      this._map.on('click', this._getPopupData, this);
      this._map.on('dblclick', this._resetPopupState, this);
    }
    return this;
  },

  unbindPopup: function () {
    if (this._map) {
      this._map.closePopup(this._popup);
      this._map.off('click', this._getPopupData, this);
      this._map.off('dblclick', this._resetPopupState, this);
    }
    this._popup = false;
    return this;
  },

  bringToFront: function () {
    this.options.position = 'front';
    if (this._currentImage) {
      this._currentImage.bringToFront();
    }
    return this;
  },

  bringToBack: function () {
    this.options.position = 'back';
    if (this._currentImage) {
      this._currentImage.bringToBack();
    }
    return this;
  },

  getAttribution: function () {
    return this.options.attribution;
  },

  getOpacity: function () {
    return this.options.opacity;
  },

  setOpacity: function (opacity) {
    this.options.opacity = opacity;
    this._currentImage.setOpacity(opacity);
    return this;
  },

  getTimeRange: function () {
    return [this.options.from, this.options.to];
  },

  setTimeRange: function (from, to) {
    this.options.from = from;
    this.options.to = to;
    this._update();
    return this;
  },

  metadata: function (callback, context) {
    this.service.metadata(callback, context);
    return this;
  },

  authenticate: function (token) {
    this.service.authenticate(token);
    return this;
  },

  _initImage: function () {
      var img = L.DomUtil.create('img','leaflet-image-layer ' + (this._zoomAnimated ? 'leaflet-zoom-animated' : ''));
      img.onselectstart = L.Util.falseFn;
      img.onmousemove = L.Util.falseFn;
      img.style.zIndex = this.options.zIndex;
      img.alt = this.options.alt;
      
      if (this.options.opacity < 1) {
          L.DomUtil.setOpacity(img, this.options.opacity);
      }
      
      return img;
  },

  _renderImages: function (params) {
         if (this._images){
      for(var i=0;i<this._images.length;i++){
        //var img  =this._images[i];
        this.getPane(this.options.pane).removeChild(this._images[i]);
        //L.DomEvent.off(this._images[i], 'click dblclick mousedown mouseup mouseover mousemove mouseout contextmenu',this._fireMouseEvent, this);
      } 
    }

    this._images=[];


    if (this._map) {
      console.log('start');
      for (var i=0;i<params.length;i++){
        var p = params[i];

        var img = this._initImage();
        img.onload = L.bind(this._imageLoaded, this, { image: img, mapParams: p });
        img.src = p.href;
      }

    }
  },

  _imageLoaded:function(params){

     var image = params.image,
        bounds = new L.Bounds(
            this._map.latLngToLayerPoint(params.mapParams.bounds.getNorthWest()),
            this._map.latLngToLayerPoint(params.mapParams.bounds.getSouthEast())),
        size = bounds.getSize();
    
    console.log(params.mapParams.bounds);
    console.log(bounds.min);
    
    L.DomUtil.setPosition(image, bounds.min);

    image.style.width  = size.x + 'px';
    image.style.height = size.y + 'px';
                
    this.getPane(this.options.pane).appendChild(image);

    this._images.push(image);
  },

  

  _update: function () {
    if (!this._map) {
      return;
    }

    var zoom = this._map.getZoom();
    var bounds = this._map.getBounds();

    if (this._animatingZoom) {
      return;
    }

    if (this._map._panTransition && this._map._panTransition._inProgress) {
      return;
    }

    if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
      return;
    }



    var params = this._buildExportParams();
    
    this._requestExport(params);
  },

  _renderPopup: function (latlng, error, results, response) {
    latlng = L.latLng(latlng);
    if (this._shouldRenderPopup && this._lastClick.equals(latlng)) {
      // add the popup to the map where the mouse was clicked at
      var content = this._popupFunction(error, results, response);
      if (content) {
        this._popup.setLatLng(latlng).setContent(content).openOn(this._map);
      }
    }
  },

  _resetPopupState: function (e) {
    this._shouldRenderPopup = false;
    this._lastClick = e.latlng;
  }
});
