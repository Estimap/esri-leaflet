import L from 'leaflet';
import { RasterLayer } from './RasterLayer';
import { cleanUrl } from '../Util';
import mapService from '../Services/MapService';

export var DynamicMapLayer = RasterLayer.extend({

  options: {
    updateInterval: 150,
    layers: false,
    layerDefs: false,
    timeOptions: false,
    format: 'png24',
    transparent: true,
    f: 'json'
  },

  initialize: function (options) {
    options.url = cleanUrl(options.url);
    this.service = mapService(options);
    this.service.addEventParent(this);

    if ((options.proxy || options.token) && options.f !== 'json') {
      options.f = 'json';
    }
    L.Util.setOptions(this, options);
  },

  getDynamicLayers: function () {
    return this.options.dynamicLayers;
  },

  setDynamicLayers: function (dynamicLayers) {
    this.options.dynamicLayers = dynamicLayers;
    this._update();
    return this;
  },

  getLayers: function () {
    return this.options.layers;
  },

  setLayers: function (layers) {
    this.options.layers = layers;
    this._update();
    return this;
  },

  getLayerDefs: function () {
    return this.options.layerDefs;
  },

  setLayerDefs: function (layerDefs) {
    this.options.layerDefs = layerDefs;
    this._update();
    return this;
  },

  getTimeOptions: function () {
    return this.options.timeOptions;
  },

  setTimeOptions: function (timeOptions) {
    this.options.timeOptions = timeOptions;
    this._update();
    return this;
  },

  query: function () {
    return this.service.query();
  },

  identify: function () {
    return this.service.identify();
  },

  find: function () {
    return this.service.find();
  },

  _getPopupData: function (e) {
    var callback = L.Util.bind(function (error, featureCollection, response) {
      if (error) { return; } // we really can't do anything here but authenticate or requesterror will fire
      setTimeout(L.Util.bind(function () {
        this._renderPopup(e.latlng, error, featureCollection, response);
      }, this), 300);
    }, this);

    var identifyRequest = this.identify().on(this._map).at(e.latlng);

    if (this.options.layers) {
      identifyRequest.layers('visible:' + this.options.layers.join(','));
    } else {
      identifyRequest.layers('visible');
    }

    identifyRequest.run(callback);

    // set the flags to show the popup
    this._shouldRenderPopup = true;
    this._lastClick = e.latlng;
  },

  _buildExportParams: function () {

    var paramsArray = [];

    var bounds = this._map.getBounds();
    var size = this._map.getSize();

    var min = bounds.getSouthWest();
    var max = bounds.getNorthEast();

    var newXmax = min.lng;
    var newXmin = min.lng;
    var i = 0;

    var d = (newXmin + 180) / 360;
    var sign = Math.sign(d);
    sign = (sign === 0) ? 1 : sign;
    var coef = sign * Math.floor(Math.abs(d));
    
    

    while (newXmax < max.lng)
    {
      newXmax =  360 * (coef + i) + sign*180;
      
      if (newXmax > max.lng)
      {
          newXmax = max.lng;
      }

      var normXMin = newXmin;
      var normXMax = newXmax;

      if ((newXmin<-180) | (newXmax>180))
      {
          var d2 = Math.floor((newXmin + 180) / 360);
          normXMin -= d2 * 360;
          normXMax -= d2 * 360;
      }

      var newBounds =  L.latLngBounds(L.latLng(min.lat, normXMin), L.latLng(max.lat, normXMax));

      var width = (size.x* ( (newXmax- newXmin)/(max.lng - min.lng) ));
      var newSize = { x: width, y:size.y };
      var exportParams = this._buildOneWorldExportParams( newBounds,newSize );
      
      paramsArray.push({ bounds: newBounds, size: newSize, params: exportParams });
      newXmin = newXmax;
      i++;
    }

    return paramsArray;
  },

  _buildOneWorldExportParams: function(bounds, size){
    var ne = this._map.options.crs.project(bounds.getNorthEast());
    var sw = this._map.options.crs.project(bounds.getSouthWest());
    var sr = parseInt(this._map.options.crs.code.split(':')[1], 10);

    // ensure that we don't ask ArcGIS Server for a taller image than we have actual map displaying
    var top = this._map.latLngToLayerPoint(bounds._northEast);
    var bottom = this._map.latLngToLayerPoint(bounds._southWest);

    if (top.y > 0 || bottom.y < size.y) {
      size.y = bottom.y - top.y;
    }

    var params = {
      bbox: [sw.x, sw.y, ne.x, ne.y].join(','),
      size: size.x + ',' + size.y,
      dpi: 96,
      format: this.options.format,
      transparent: this.options.transparent,
      bboxSR: sr,
      imageSR: sr
    };

    if (this.options.dynamicLayers) {
      params.dynamicLayers = this.options.dynamicLayers;
    }

    if (this.options.layers) {
      params.layers = 'show:' + this.options.layers.join(',');
    }

    if (this.options.layerDefs) {
      params.layerDefs = JSON.stringify(this.options.layerDefs);
    }

    if (this.options.timeOptions) {
      params.timeOptions = JSON.stringify(this.options.timeOptions);
    }

    if (this.options.from && this.options.to) {
      params.time = this.options.from.valueOf() + ',' + this.options.to.valueOf();
    }

    if (this.service.options.token) {
      params.token = this.service.options.token;
    }

    return params;
  },

  _requestExport: function (params) {
    for(var i=0; i< params.length;i++){
      var currentParam = params[i];
      if (this.options.f === 'json') {
        this.service.request('export', currentParam.params, function (error, response) {
          if (error) { return; } // we really can't do anything here but authenticate or requesterror will fire
          currentParam.href = response.href;
        }, this);
      } else {
        currentParam.params.f = 'image';
        currentParam.href = this.options.url + 'export' + L.Util.getParamString(currentParam.params);
      }
    }
    this._renderImages(params);
  }
});

export function dynamicMapLayer (url, options) {
  return new DynamicMapLayer(url, options);
}

export default dynamicMapLayer;
