'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Map from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GIS_DATA } from '@/data/store';

export interface LayerVisibility {
  highways: boolean;
  traRail: boolean;
  thsr: boolean;
  portsAirports: boolean;
  powerGrid: boolean;
  powerSubDetail: boolean;
  windPower: boolean;
  solarPower: boolean;
  geothermalPower: boolean;
  waterNodes: boolean;
  digitalNodes: boolean;
}

export default function DeckGLMap({
  activeEvent,
  viewState,
  setViewState,
  selectedYear,
  layerVisibility
}: {
  activeEvent: any;
  viewState: any;
  setViewState: any;
  selectedYear: number;
  layerVisibility: LayerVisibility;
}) {
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [officialPorts, setOfficialPorts] = useState<any>(null);
  const [offshoreAirports, setOffshoreAirports] = useState<any>(null);
  const [powerSubstations, setPowerSubstations] = useState<any>(null);
  const [powerLines, setPowerLines] = useState<any>(null);
  const [windPowerSites, setWindPowerSites] = useState<any>(null);
  const [solarPowerSites, setSolarPowerSites] = useState<any>(null);
  const [geothermalPowerSites, setGeothermalPowerSites] = useState<any>(null);

  useEffect(() => {
    fetch('/data/official-ports.geojson')
      .then(r => r.json())
      .then(data => {
        const filtered = {
          ...data,
          features: (data.features || []).filter(
            (ft: any) =>
              ft.properties?.category === 'commercial_port' ||
              ft.properties?.category === 'industrial_port'
          )
        };
        setOfficialPorts(filtered);
      })
      .catch(() => {});

    fetch('/data/official-airports-offshore.geojson')
      .then(r => r.json())
      .then(setOffshoreAirports)
      .catch(() => {});

    fetch('/data/official-power-substations.geojson')
      .then(r => r.json())
      .then(setPowerSubstations)
      .catch(() => {});

    fetch('/data/official-power-lines.geojson')
      .then(r => r.json())
      .then(setPowerLines)
      .catch(() => {});

    fetch('/data/official-wind-power.geojson')
      .then(r => r.json())
      .then(setWindPowerSites)
      .catch(() => {});

    fetch('/data/official-solar-power.geojson')
      .then(r => r.json())
      .then(setSolarPowerSites)
      .catch(() => {});

    fetch('/data/official-geothermal-power.geojson')
      .then(r => r.json())
      .then(setGeothermalPowerSites)
      .catch(() => {});
  }, []);

  const filteredPowerLines = useMemo(() => {
    if (!powerLines?.features) return null;
    const z = viewState?.zoom ?? 7.2;
    const showAll = layerVisibility.powerSubDetail;
    return {
      ...powerLines,
      features: powerLines.features.filter((ft: any) => {
        const tier = ft.properties?.voltage_tier;
        if (tier === '345kV') return true;
        if (showAll) return true;
        if (tier === '161kV') return z >= 8.2;
        return z >= 9.6;
      })
    };
  }, [powerLines, layerVisibility.powerSubDetail, Math.floor((viewState?.zoom ?? 7.2) * 2)]);

  const filteredPowerSubstations = useMemo(() => {
    if (!powerSubstations?.features) return null;
    const z = viewState?.zoom ?? 7.2;
    const showAll = layerVisibility.powerSubDetail;
    return {
      ...powerSubstations,
      features: powerSubstations.features.filter((ft: any) => {
        const tier = ft.properties?.voltage_tier;
        if (tier === '345kV') return true;
        if (showAll) return true;
        if (tier === '161kV') return z >= 8.2;
        return z >= 9.6;
      })
    };
  }, [powerSubstations, layerVisibility.powerSubDetail, Math.floor((viewState?.zoom ?? 7.2) * 2)]);

  const visibleHubs = GIS_DATA.hubs.filter(h => h.activeFrom <= selectedYear);
  const visiblePowerPlants = GIS_DATA.powerPlants.filter(p => p.activeFrom <= selectedYear);
  const visibleWater = GIS_DATA.waterNodes.filter(w => w.activeFrom <= selectedYear);
  const visibleDigital = GIS_DATA.digitalNodes.filter(d => d.activeFrom <= selectedYear);
  const mainlandAirports = GIS_DATA.portsAndAirports.filter(
    p => p.kind === 'Airport' && p.activeFrom <= selectedYear
  );

  const layers: any[] = [
    // 1. Metropolitan Population Clusters (Fixed pixel size)
    new ScatterplotLayer({
      id: 'cities-layer',
      data: GIS_DATA.cities,
      getPosition: (d: any) => d.coords,
      radiusUnits: 'pixels',
      getRadius: (d: any) => Math.max(10, Math.min(24, Math.sqrt(d.pop / 10000) * 1.1)),
      getFillColor: [100, 116, 139, 38],
      getLineColor: [203, 213, 225, 160],
      lineWidthUnits: 'pixels',
      getLineWidth: 1,
      stroked: true,
      pickable: false
    }),

    // 2. Official NLSC Highways & Expressways
    layerVisibility.highways &&
      new GeoJsonLayer({
        id: 'official-highways-layer',
        data: '/data/official-highways.geojson',
        pickable: true,
        stroked: true,
        filled: false,
        lineWidthUnits: 'pixels',
        lineCapRounded: true,
        lineJoinRounded: true,
        getLineColor: (f: any) =>
          f.properties?.category === 'freeway' ? [71, 85, 105, 195] : [100, 116, 139, 170],
        getLineWidth: (f: any) => (f.properties?.category === 'freeway' ? 1.8 : 1.3),
        onHover: (info: any) =>
          setHoverInfo(
            info.object
              ? {
                  name: info.object.properties?.name || info.object.properties?.road_num || '國省道',
                  sub: `${info.object.properties?.county || ''} · 國土測繪中心官方路網`,
                  x: info.x,
                  y: info.y
                }
              : null
          )
      }),

    // 3. Official NLSC TRA Railway Network
    layerVisibility.traRail &&
      new GeoJsonLayer({
        id: 'official-rail-layer',
        data: '/data/official-rail.geojson',
        pickable: true,
        stroked: true,
        filled: false,
        lineWidthUnits: 'pixels',
        lineCapRounded: true,
        lineJoinRounded: true,
        getLineColor: [148, 163, 184, 205],
        getLineWidth: 1.4,
        onHover: (info: any) =>
          setHoverInfo(
            info.object
              ? {
                  name: info.object.properties?.name || '臺鐵路線',
                  sub: info.object.properties?.bridge_tunnel
                    ? `構造物：${info.object.properties.bridge_tunnel}`
                    : '國土測繪中心官方鐵路圖資',
                  x: info.x,
                  y: info.y
                }
              : null
          )
      }),

    // 4. Official TDX THSR High-Density Curve + 12 Stations
    layerVisibility.thsr &&
      new GeoJsonLayer({
        id: 'official-thsr-complete-layer',
        data: '/data/official-thsr-complete.geojson',
        pickable: true,
        stroked: true,
        filled: true,
        lineWidthUnits: 'pixels',
        lineCapRounded: true,
        lineJoinRounded: true,
        getLineColor: [30, 41, 59, 235],
        getLineWidth: 2.2,
        pointRadiusUnits: 'pixels',
        getPointRadius: 4.5,
        getFillColor: [255, 255, 255, 255],
        onHover: (info: any) => {
          if (!info.object) {
            setHoverInfo(null);
            return;
          }
          const props = info.object.properties || {};
          if (props.feature_type === 'station') {
            setHoverInfo({
              name: `${props.name} (${props.code})`,
              sub: `里程基準：${props.mileage_km} km · 交通部 TDX 站點`,
              x: info.x,
              y: info.y
            });
          } else {
            setHoverInfo({
              name: props.name || '台灣高鐵實測路線',
              sub: `全長 ${props.length_km} km · 交通部 TDX Rail/THSR/Shape`,
              x: info.x,
              y: info.y
            });
          }
        }
      }),

    // 5. High-Voltage Transmission Lines
    layerVisibility.powerGrid &&
      filteredPowerLines &&
      new GeoJsonLayer({
        id: 'official-power-lines-layer',
        data: filteredPowerLines,
        pickable: true,
        stroked: true,
        filled: false,
        lineWidthUnits: 'pixels',
        lineCapRounded: true,
        lineJoinRounded: true,
        getLineColor: (f: any) => {
          const tier = f.properties?.voltage_tier;
          if (tier === '345kV') return [180, 83, 9, 220];
          if (tier === '161kV') return [217, 119, 6, 185];
          return [245, 158, 11, 145];
        },
        getLineWidth: (f: any) => {
          const tier = f.properties?.voltage_tier;
          if (tier === '345kV') return 2.0;
          if (tier === '161kV') return 1.3;
          return 1.0;
        },
        onHover: (info: any) =>
          setHoverInfo(
            info.object
              ? {
                  name: info.object.properties?.name || '高壓輸電線路',
                  sub: `電壓等級：${info.object.properties?.voltage_label || '高壓'} · 輸電走廊`,
                  x: info.x,
                  y: info.y
                }
              : null
          )
      }),

    // 6. Power Substations (Fixed-Pixel Centroids)
    layerVisibility.powerGrid &&
      filteredPowerSubstations &&
      new GeoJsonLayer({
        id: 'official-power-substations-layer',
        data: filteredPowerSubstations,
        pickable: true,
        stroked: true,
        filled: true,
        pointRadiusUnits: 'pixels',
        getPointRadius: (f: any) => {
          const tier = f.properties?.voltage_tier;
          if (tier === '345kV') return 5.5;
          if (tier === '161kV') return 4.0;
          return 3.0;
        },
        getFillColor: [255, 255, 255, 255],
        getLineColor: (f: any) => {
          const tier = f.properties?.voltage_tier;
          if (tier === '345kV') return [180, 83, 9, 255];
          if (tier === '161kV') return [217, 119, 6, 245];
          return [245, 158, 11, 230];
        },
        lineWidthUnits: 'pixels',
        getLineWidth: (f: any) => (f.properties?.voltage_tier === '345kV' ? 2 : 1.5),
        onHover: (info: any) => {
          if (!info.object) {
            setHoverInfo(null);
            return;
          }
          const p = info.object.properties || {};
          const parts = [p.voltage_label, p.rating, p.operator].filter(Boolean);
          setHoverInfo({
            name: p.name || '變電所',
            sub: parts.join(' · '),
            x: info.x,
            y: info.y
          });
        }
      }),

    // 7. Major Power Generation Plants
    layerVisibility.powerGrid &&
      new ScatterplotLayer({
        id: 'power-plants-layer',
        data: visiblePowerPlants,
        getPosition: (d: any) => d.coords,
        radiusUnits: 'pixels',
        getRadius: 6.5,
        getFillColor: [180, 83, 9, 245],
        getLineColor: [255, 255, 255, 255],
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        stroked: true,
        pickable: true,
        onHover: (info: any) =>
          setHoverInfo(
            info.object
              ? { name: info.object.name, sub: `${info.object.township} · ${info.object.capacity}`, x: info.x, y: info.y }
              : null
          )
      }),

    // 8. Wind Power Layer (26 Sites: 25 Onshore + 1 Offshore Phase 1, Fixed-Pixel Nodes)
    layerVisibility.windPower &&
      windPowerSites &&
      new GeoJsonLayer({
        id: 'official-wind-power-layer',
        data: windPowerSites,
        pickable: true,
        stroked: true,
        filled: true,
        pointRadiusUnits: 'pixels',
        getPointRadius: (f: any) => (f.properties?.energy_type === 'offshore_wind' ? 7.0 : 5.5),
        getFillColor: (f: any) =>
          f.properties?.energy_type === 'offshore_wind'
            ? [8, 145, 178, 245]    // #0891b2 實心翠青代表離岸風力
            : [255, 255, 255, 255], // 白底代表陸域風力
        getLineColor: (f: any) =>
          f.properties?.energy_type === 'offshore_wind'
            ? [255, 255, 255, 255]
            : f.properties?.status === '試運轉'
            ? [6, 182, 212, 255]
            : [8, 145, 178, 255],
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        onHover: (info: any) => {
          if (!info.object) {
            setHoverInfo(null);
            return;
          }
          const p = info.object.properties || {};
          setHoverInfo({
            name: `${p.name} · ${p.site_desc}`,
            sub: `${p.energy_label} · ${p.capacity_mw} MW (${p.turbine_count} 部 ${p.model}) · ${p.status}${
              p.address ? ' · ' + p.address : ''
            }`,
            x: info.x,
            y: info.y
          });
        }
      }),

    // 9. Solar Power Layer (71 Sites across 45 Stations, Fixed-Pixel Nodes)
    layerVisibility.solarPower &&
      solarPowerSites &&
      new GeoJsonLayer({
        id: 'official-solar-power-layer',
        data: solarPowerSites,
        pickable: true,
        stroked: true,
        filled: true,
        pointRadiusUnits: 'pixels',
        getPointRadius: (f: any) => (f.properties?.is_utility_scale ? 6.8 : 4.5),
        getFillColor: (f: any) =>
          f.properties?.is_utility_scale
            ? [234, 88, 12, 245]    // #ea580c 實心亮橘代表大型地面光電 (>=10MW: 彰濱/台南鹽田/核三地面)
            : [255, 255, 255, 255], // 白底代表屋頂型/配水池/變電所光電
        getLineColor: (f: any) =>
          f.properties?.is_utility_scale
            ? [255, 255, 255, 255]
            : [234, 88, 12, 255],
        lineWidthUnits: 'pixels',
        getLineWidth: 1.8,
        onHover: (info: any) => {
          if (!info.object) {
            setHoverInfo(null);
            return;
          }
          const p = info.object.properties || {};
          setHoverInfo({
            name: `${p.name} · ${p.site_desc}`,
            sub: `${p.energy_label} · ${p.capacity_mw} MW (${p.capacity_kw.toLocaleString()} kW) · ${p.status}${
              p.address ? ' · ' + p.address : ''
            }`,
            x: info.x,
            y: info.y
          });
        }
      }),

    // 10. Geothermal Power Layer (1 Site: 仁澤地熱 840 kW, Fixed-Pixel Node)
    layerVisibility.geothermalPower &&
      geothermalPowerSites &&
      new GeoJsonLayer({
        id: 'official-geothermal-power-layer',
        data: geothermalPowerSites,
        pickable: true,
        stroked: true,
        filled: true,
        pointRadiusUnits: 'pixels',
        getPointRadius: 6.5,
        getFillColor: [225, 29, 72, 245], // #e11d48 實心玫紅代表地熱發電
        getLineColor: [255, 255, 255, 255],
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        onHover: (info: any) => {
          if (!info.object) {
            setHoverInfo(null);
            return;
          }
          const p = info.object.properties || {};
          setHoverInfo({
            name: `${p.name} (${p.site_desc})`,
            sub: `${p.energy_label} · ${p.capacity_kw} kW (${p.capacity_mw} MW) · ${p.status}${
              p.address ? ' · ' + p.address : ''
            }`,
            x: info.x,
            y: info.y
          });
        }
      }),

    // 11. Official Commercial & Industrial Ports
    layerVisibility.portsAirports &&
      officialPorts &&
      new GeoJsonLayer({
        id: 'official-ports-layer',
        data: officialPorts,
        pickable: true,
        stroked: true,
        filled: true,
        pointRadiusUnits: 'pixels',
        getPointRadius: 5.5,
        getFillColor: (f: any) =>
          f.properties?.category === 'industrial_port' ? [13, 148, 136, 245] : [15, 118, 110, 245],
        getLineColor: [255, 255, 255, 255],
        lineWidthUnits: 'pixels',
        getLineWidth: 1.5,
        onHover: (info: any) =>
          setHoverInfo(
            info.object
              ? {
                  name: info.object.properties?.name,
                  sub: `${
                    info.object.properties?.category === 'industrial_port' ? '工業專用港' : '官方商港'
                  } ${info.object.properties?.address ? '· ' + info.object.properties.address : ''}`,
                  x: info.x,
                  y: info.y
                }
              : null
          )
      }),

    // 12. Airports (Mainland + Offshore)
    layerVisibility.portsAirports &&
      new ScatterplotLayer({
        id: 'mainland-airports-layer',
        data: mainlandAirports,
        getPosition: (d: any) => d.coords,
        radiusUnits: 'pixels',
        getRadius: 6,
        getFillColor: [29, 78, 216, 245],
        getLineColor: [255, 255, 255, 255],
        lineWidthUnits: 'pixels',
        getLineWidth: 1.5,
        stroked: true,
        pickable: true,
        onHover: (info: any) =>
          setHoverInfo(
            info.object
              ? { name: info.object.name, sub: `${info.object.township} · 國際航空門戶`, x: info.x, y: info.y }
              : null
          )
      }),

    layerVisibility.portsAirports &&
      offshoreAirports &&
      new GeoJsonLayer({
        id: 'offshore-airports-layer',
        data: offshoreAirports,
        pickable: true,
        stroked: true,
        filled: true,
        pointRadiusUnits: 'pixels',
        getPointRadius: 4.5,
        getFillColor: [59, 130, 246, 235],
        getLineColor: [255, 255, 255, 255],
        lineWidthUnits: 'pixels',
        getLineWidth: 1.5,
        onHover: (info: any) =>
          setHoverInfo(
            info.object
              ? {
                  name: info.object.properties?.name,
                  sub: info.object.properties?.address || '離島航空站',
                  x: info.x,
                  y: info.y
                }
              : null
          )
      }),

    // 13. Water System Nodes
    layerVisibility.waterNodes &&
      new ScatterplotLayer({
        id: 'water-nodes-layer',
        data: visibleWater,
        getPosition: (d: any) => d.coords,
        radiusUnits: 'pixels',
        getRadius: 5,
        getFillColor: [255, 255, 255, 255],
        getLineColor: [37, 99, 235, 255],
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        stroked: true,
        pickable: true,
        onHover: (info: any) =>
          setHoverInfo(
            info.object
              ? { name: info.object.name, sub: `${info.object.township} · 水資源${info.object.role}`, x: info.x, y: info.y }
              : null
          )
      }),

    // 14. Digital & Subsea Landing Nodes
    layerVisibility.digitalNodes &&
      new ScatterplotLayer({
        id: 'digital-nodes-layer',
        data: visibleDigital,
        getPosition: (d: any) => d.coords,
        radiusUnits: 'pixels',
        getRadius: 5,
        getFillColor: [255, 255, 255, 255],
        getLineColor: [109, 40, 217, 255],
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        stroked: true,
        pickable: true,
        onHover: (info: any) =>
          setHoverInfo(
            info.object
              ? { name: info.object.name, sub: `${info.object.township} · 數位${info.object.role}`, x: info.x, y: info.y }
              : null
          )
      }),

    // 15. Semiconductor Core Load Terminals
    new ScatterplotLayer({
      id: 'hubs-layer',
      data: visibleHubs,
      getPosition: (d: any) => d.coords,
      radiusUnits: 'pixels',
      getRadius: (d: any) => (activeEvent?.node === d.id ? 8.5 : 7),
      getFillColor: (d: any) => (activeEvent?.node === d.id ? [220, 38, 38, 255] : [15, 23, 42, 255]),
      getLineColor: [255, 255, 255, 255],
      lineWidthUnits: 'pixels',
      getLineWidth: 2,
      stroked: true,
      pickable: true,
      onHover: (info: any) =>
        setHoverInfo(
          info.object
            ? { name: info.object.name, sub: `${info.object.township} · ${info.object.type}`, x: info.x, y: info.y }
            : null
        ),
      updateTriggers: {
        getFillColor: [activeEvent?.node],
        getRadius: [activeEvent?.node]
      }
    })
  ].filter(Boolean);

  return (
    <div className="absolute inset-0 w-full h-full z-0 bg-slate-50">
      <DeckGL
        viewState={viewState}
        onViewStateChange={(e: any) => setViewState(e.viewState)}
        controller={true}
        layers={layers}
      >
        <Map
          reuseMaps
          mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        />
      </DeckGL>

      {/* Bottom-Left Fixed-Pixel Legend */}
      <div className="pointer-events-auto fixed bottom-6 left-6 z-10 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-2.5 shadow-sm text-[11px] text-slate-700 hidden md:flex flex-col gap-1.5">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          固定像素節點與再生能源電網圖例
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-slate-900 border-2 border-white shadow-sm inline-block" />
          <span>晶圓廠 / 核心負載 (異常轉紅)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-700 border border-white inline-block" />
          <span>傳統電廠</span>
          <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-amber-700 inline-block ml-1" />
          <span>345kV E/S</span>
          <span className="w-2 h-2 rounded-full bg-white border-[1.5px] border-amber-500 inline-block ml-1" />
          <span>161/69kV</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-cyan-600 inline-block" />
          <span>陸域風力</span>
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 border border-white inline-block ml-1" />
          <span>離岸風力</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-600 border border-white inline-block" />
          <span>大型光電</span>
          <span className="w-2 h-2 rounded-full bg-white border-2 border-orange-600 inline-block ml-1" />
          <span>屋頂光電</span>
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-white inline-block ml-1" />
          <span>地熱</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-800 inline-block" />
          <span>高鐵</span>
          <span className="w-2.5 h-2.5 rounded-full bg-blue-700 border border-white inline-block ml-1" />
          <span>機場</span>
          <span className="w-2.5 h-2.5 rounded-full bg-teal-700 border border-white inline-block ml-1" />
          <span>商港</span>
          <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-600 inline-block ml-1" />
          <span>水</span>
          <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-purple-700 inline-block ml-1" />
          <span>海纜</span>
        </div>
      </div>

      {hoverInfo && (
        <div
          style={{ left: hoverInfo.x + 12, top: hoverInfo.y + 12 }}
          className="pointer-events-none fixed z-40 bg-white/95 backdrop-blur-sm border border-slate-200 px-3 py-2 rounded-lg shadow-md text-xs text-slate-800 max-w-xs"
        >
          <div className="font-bold">{hoverInfo.name}</div>
          {hoverInfo.sub && <div className="text-[11px] text-slate-500 mt-0.5">{hoverInfo.sub}</div>}
        </div>
      )}
    </div>
  );
}
