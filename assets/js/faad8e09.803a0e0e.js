"use strict";(self.webpackChunkdocs_website=self.webpackChunkdocs_website||[]).push([[803],{4181:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>s,default:()=>d,frontMatter:()=>o,metadata:()=>r,toc:()=>m});var a=t(4848),i=t(8453);const o={},s="Loon Data",r={id:"getting-started/data",title:"Loon Data",description:"Experiment Data",source:"@site/docs/getting-started/data.md",sourceDirName:"getting-started",slug:"/getting-started/data",permalink:"/loonar/docs/getting-started/data",draft:!1,unlisted:!1,tags:[],version:"current",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"Building and Running Loon From Source",permalink:"/loonar/docs/getting-started/building-loon"},next:{title:"How-To-Guides",permalink:"/loonar/docs/category/how-to-guides"}},c={},m=[{value:"Experiment Data",id:"experiment-data",level:2},{value:"List of Experiments",id:"list-of-experiments",level:2}];function l(e){const n={code:"code",h1:"h1",h2:"h2",p:"p",pre:"pre",...(0,i.R)(),...e.components};return(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)(n.h1,{id:"loon-data",children:"Loon Data"}),"\n",(0,a.jsx)(n.h2,{id:"experiment-data",children:"Experiment Data"}),"\n",(0,a.jsx)(n.p,{children:"Each experiment has a corresponding configuration file which specifies the locations of the segmentations, the metadata table, and the images. It also contains other important information such as the header names and which columns map to which Loon attribute. Below is an example of a configuration file."}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{className:"language-json",metastring:'title="ExperimentOne.json"',children:'{\n  "name": "ExperimentOne",\n  "headers": [\n    "Frame",\n    "Tracking ID",\n    "Lineage ID",\n    "Position X (\\u00b5m)",\n    "Position Y (\\u00b5m)",\n    "Pixel Position X (pixels)",\n    "Pixel Position Y (pixels)",\n    "Volume (\\u00b5m\\u00b3)",\n    "Mean Thickness (\\u00b5m)",\n    "Radius (\\u00b5m)",\n    "Area (\\u00b5m\\u00b2)",\n    "Sphericity ()",\n    "Length (\\u00b5m)",\n    "Width (\\u00b5m)",\n    "Orientation (\\u00b0)",\n    "Dry Mass (pg)",\n    "Displacement (\\u00b5m)",\n    "Instantaneous Velocity (\\u00b5m/s)",\n    "Instantaneous Velocity X (\\u00b5m/s)",\n    "Instantaneous Velocity Y (\\u00b5m/s)",\n    "Track Length (\\u00b5m)"\n  ],\n  "headerTransforms": {\n    "time": "Frame",\n    "frame": "Frame",\n    "id": "Tracking ID",\n    "parent": "Tracking ID",\n    "mass": "Dry Mass (pg)",\n    "x": "Position X (\\u00b5m)",\n    "y": "Position Y (\\u00b5m)"\n  },\n  "locationMetadataList": [\n    {\n      "id": "1",\n      "tabularDataFilename": "ExperimentOne/location_0/B2_6_feature_table.csv",\n      "imageDataFilename": "ExperimentOne/location_0/images/20240607_624 mel KO_pharm Inhib_B2_6_Phase.companion.ome",\n      "segmentationsFolder": "ExperimentOne/location_0/segmentations"\n    }\n  ]\n}\n'})}),"\n",(0,a.jsx)(n.h2,{id:"list-of-experiments",children:"List of Experiments"}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{className:"language-json",metastring:'title="aa_index.json"',children:'{\n  "experiments": ["ExpermientOne.json"]\n}\n'})})]})}function d(e={}){const{wrapper:n}={...(0,i.R)(),...e.components};return n?(0,a.jsx)(n,{...e,children:(0,a.jsx)(l,{...e})}):l(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>s,x:()=>r});var a=t(6540);const i={},o=a.createContext(i);function s(e){const n=a.useContext(o);return a.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function r(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:s(e.components),a.createElement(o.Provider,{value:n},e.children)}}}]);