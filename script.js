require([
  'Canvas-Flowmap-Layer/CanvasFlowmapLayer',
  'esri/graphic',
  'esri/map',
  'esri/layers/GraphicsLayer',
  'dojo/request',
  'dojo/on',
  'dojo/domReady!'
], function(CanvasFlowmapLayer, Graphic, Map, GraphicsLayer, request, on) {

  // --- Initialize map ---
  var map = new Map('map', {
    basemap: 'gray-vector',
    center: [66.9, 34.5],  // Afghanistan center
    zoom: 6
  });

  // --- Add provinces layer ---
  var provinceLayer = new GraphicsLayer();
  map.addLayer(provinceLayer);

  request.get("csv-data/province.json", { handleAs: "json" }).then(function(data) {
    data.features.forEach(function(feature) {
      var graphic = new Graphic({
        geometry: feature.geometry,
        attributes: feature.properties,
        symbol: {
          type: "esriSFS",          // simple fill
          style: "esriSFSSolid",    // solid fill
          color: [0,0,0,0],         // transparent fill
          outline: {                 // province border
            type: "esriSLS",
            style: "esriSLSSolid",
            color: [120,120,120,255],
            width: 1
          }
        }
      });
      provinceLayer.add(graphic);
    });
  });

  // --- Add flow map after map loads ---
  map.on('load', function() {

    var oneToManyLayer = new CanvasFlowmapLayer({
      id: 'oneToManyLayer',
      visible: true,
      originAndDestinationFieldIds: {
        originUniqueIdField: 's_city_id',
        originGeometry: { x: 's_lon', y: 's_lat', spatialReference: { wkid: 4326 } },
        destinationUniqueIdField: 'e_city_id',
        destinationGeometry: { x: 'e_lon', y: 'e_lat', spatialReference: { wkid: 4326 } }
      },
      pathDisplayMode: 'selection',
      wrapAroundCanvas: true,
      animationStarted: true,
      pathProperties: {
        type: 'classBreaks',
        field: 'e_vol',
        classBreakInfos: [
          {
            classMinValue: 1,
            classMaxValue: 25000,
            symbol: { strokeStyle: 'rgba(255,202,85,0.8)', lineWidth: 1, lineCap:'round' }
          },
          {
            classMinValue: 25001,
            classMaxValue: 100000,
            symbol: { strokeStyle: 'rgba(255,141,87,0.8)', lineWidth: 3, lineCap:'round' }
          },
          {
            classMinValue: 100001,
            classMaxValue: 642181,
            symbol: { strokeStyle: 'rgba(210,38,48,0.8)', lineWidth: 5, lineCap:'round' }
          }
        ]
      }
    });

    map.addLayer(oneToManyLayer);
    createGraphicsFromCsv('csv-data/inflow_v1.csv', oneToManyLayer);

    // --- CSV parsing and city selector ---
    function createGraphicsFromCsv(csvFilePath, canvasLayer) {
      Papa.parse(csvFilePath, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(results) {

          // Create graphics for flow map
          var csvGraphics = results.data.map(function(datum) {
            return new Graphic({
              geometry: { x: datum.s_lon, y: datum.s_lat, spatialReference: { wkid: 4326 } },
              attributes: datum
            });
          });
          canvasLayer.addGraphics(csvGraphics);

          // Populate city selector
          let uniqueCities = [...new Set(results.data.map(d => d.s_city).filter(c => c))].sort();
          let citySelector = document.getElementById('sCitySelect');
          citySelector.innerHTML = '';

          // Add "All FMPs" checkbox
          let allCheckbox = document.createElement('div');
          allCheckbox.innerHTML = `<label><input type="checkbox" value="__all__" checked> <strong>All FMPs</strong></label>`;
          citySelector.appendChild(allCheckbox);

          // Add individual cities
          uniqueCities.forEach(city => {
            let checkbox = document.createElement('div');
            checkbox.innerHTML = `<label><input type="checkbox" value="${city}"> ${city}</label><br>`;
            citySelector.appendChild(checkbox);
          });

          // Handle city selection changes
          citySelector.addEventListener('change', function() {
            let checkboxes = citySelector.querySelectorAll('input[type="checkbox"]');
            let selectedValues = Array.from(checkboxes)
              .filter(cb => cb.checked)
              .map(cb => cb.value);

            if (selectedValues.includes('__all__')) {
              canvasLayer.selectGraphicsForPathDisplay(canvasLayer.graphics, 'SELECTION_NEW');
              return;
            }

            let matchingGraphics = canvasLayer.graphics.filter(
              g => selectedValues.includes(g.attributes.s_city)
            );
            canvasLayer.selectGraphicsForPathDisplay(matchingGraphics, 'SELECTION_NEW');
          });

          // Initial select all
          canvasLayer.selectGraphicsForPathDisplay(canvasLayer.graphics, 'SELECTION_NEW');
        }
      });
    }

  });

});
