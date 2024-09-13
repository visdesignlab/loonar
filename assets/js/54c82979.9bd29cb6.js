"use strict";(self.webpackChunkdocs_website=self.webpackChunkdocs_website||[]).push([[254],{9761:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>a,default:()=>h,frontMatter:()=>s,metadata:()=>c,toc:()=>u});var o=n(4848),r=n(8453),i=n(5871);const s={},a="Getting Started",c={id:"getting-started/index",title:"Getting Started",description:"Below we list some core concepts of Loon and how to get started visualizing your data.",source:"@site/docs/getting-started/index.md",sourceDirName:"getting-started",slug:"/getting-started/",permalink:"/loonar/docs/getting-started/",draft:!1,unlisted:!1,tags:[],version:"current",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"What Is Loon",permalink:"/loonar/docs/introduction"},next:{title:"Official Loon Docker Images",permalink:"/loonar/docs/getting-started/loon-wrappers"}},l={},u=[{value:"Loon Variations",id:"loon-variations",level:2},{value:"Installing and Running Loon",id:"installing-and-running-loon",level:2},{value:"Official Images",id:"official-images",level:3},{value:"Building From Source",id:"building-from-source",level:3}];function d(e){const t={a:"a",h1:"h1",h2:"h2",h3:"h3",p:"p",strong:"strong",...(0,r.R)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(t.h1,{id:"getting-started",children:"Getting Started"}),"\n",(0,o.jsx)(t.p,{children:"Below we list some core concepts of Loon and how to get started visualizing your data."}),"\n",(0,o.jsx)(t.h2,{id:"loon-variations",children:"Loon Variations"}),"\n",(0,o.jsxs)(t.p,{children:["There are two distinct versions of Loon which will be supported. The standard Loon and ",(0,o.jsx)(t.strong,{children:"Local Loon"}),". Local Loon comes with all the features that the standard Loon supports except for data upload. Local Loon instead runs a simple server from a specified volume path where your data is already expected to reside in the correct format. This is especially useful for users that do not need the data processing features and subsequent long wait times to process large amounts of data."]}),"\n",(0,o.jsx)(t.h2,{id:"installing-and-running-loon",children:"Installing and Running Loon"}),"\n",(0,o.jsx)(t.p,{children:"There are two ways you can choose to run Loon: using the official Docker images or building from the source."}),"\n",(0,o.jsx)(t.h3,{id:"official-images",children:"Official Images"}),"\n",(0,o.jsxs)(t.p,{children:["If you're looking for the quickest way to get started with Loon, we suggest using one of the official Docker images. Each of these images initializes a Docker container with some basic configurations and then starts each service within that container. While there is minimal configuration that is supported for these images, it is great for most use cases. Please see ",(0,o.jsx)(t.a,{href:"./loon-wrappers",children:"here"})," for information on the official images."]}),"\n",(0,o.jsx)(t.h3,{id:"building-from-source",children:"Building From Source"}),"\n",(0,o.jsxs)(t.p,{children:["If you require more custom configuration for your Loon application, consider building the Docker images from source. Unlike the official images, there is no need for a single wrapper image around the multi-container application. Instead, we leverage Docker Compose to create each container. While more technically challenging, building from source allows for more custom configuration and has a robust set of logs for debugging. See ",(0,o.jsx)(t.a,{href:"./building-loon",children:"here"})," for more information."]}),"\n","\n",(0,o.jsx)(i.A,{})]})}function h(e={}){const{wrapper:t}={...(0,r.R)(),...e.components};return t?(0,o.jsx)(t,{...e,children:(0,o.jsx)(d,{...e})}):d(e)}},5871:(e,t,n)=>{n.d(t,{A:()=>k});var o=n(6540),r=n(4164),i=n(1754),s=n(8774),a=n(4586);const c=["zero","one","two","few","many","other"];function l(e){return c.filter((t=>e.includes(t)))}const u={locale:"en",pluralForms:l(["one","other"]),select:e=>1===e?"one":"other"};function d(){const{i18n:{currentLocale:e}}=(0,a.A)();return(0,o.useMemo)((()=>{try{return function(e){const t=new Intl.PluralRules(e);return{locale:e,pluralForms:l(t.resolvedOptions().pluralCategories),select:e=>t.select(e)}}(e)}catch(t){return console.error(`Failed to use Intl.PluralRules for locale "${e}".\nDocusaurus will fallback to the default (English) implementation.\nError: ${t.message}\n`),u}}),[e])}function h(){const e=d();return{selectMessage:(t,n)=>function(e,t,n){const o=e.split("|");if(1===o.length)return o[0];o.length>n.pluralForms.length&&console.error(`For locale=${n.locale}, a maximum of ${n.pluralForms.length} plural forms are expected (${n.pluralForms.join(",")}), but the message contains ${o.length}: ${e}`);const r=n.select(t),i=n.pluralForms.indexOf(r);return o[Math.min(i,o.length-1)]}(n,t,e)}}var f=n(6654),g=n(1312),m=n(1107);const p={cardContainer:"cardContainer_fWXF",cardTitle:"cardTitle_rnsV",cardDescription:"cardDescription_PWke"};var x=n(4848);function w(e){let{href:t,children:n}=e;return(0,x.jsx)(s.A,{href:t,className:(0,r.A)("card padding--lg",p.cardContainer),children:n})}function j(e){let{href:t,icon:n,title:o,description:i}=e;return(0,x.jsxs)(w,{href:t,children:[(0,x.jsxs)(m.A,{as:"h2",className:(0,r.A)("text--truncate",p.cardTitle),title:o,children:[n," ",o]}),i&&(0,x.jsx)("p",{className:(0,r.A)("text--truncate",p.cardDescription),title:i,children:i})]})}function v(e){let{item:t}=e;const n=(0,i.Nr)(t),o=function(){const{selectMessage:e}=h();return t=>e(t,(0,g.T)({message:"{count} items",id:"theme.docs.DocCard.categoryDescription.plurals",description:"The default description for a category card in the generated index about how many items this category includes"},{count:t}))}();return n?(0,x.jsx)(j,{href:n,icon:"\ud83d\uddc3\ufe0f",title:t.label,description:t.description??o(t.items.length)}):null}function b(e){let{item:t}=e;const n=(0,f.A)(t.href)?"\ud83d\udcc4\ufe0f":"\ud83d\udd17",o=(0,i.cC)(t.docId??void 0);return(0,x.jsx)(j,{href:t.href,icon:n,title:t.label,description:t.description??o?.description})}function y(e){let{item:t}=e;switch(t.type){case"link":return(0,x.jsx)(b,{item:t});case"category":return(0,x.jsx)(v,{item:t});default:throw new Error(`unknown item type ${JSON.stringify(t)}`)}}function L(e){let{className:t}=e;const n=(0,i.$S)();return(0,x.jsx)(k,{items:n.items,className:t})}function k(e){const{items:t,className:n}=e;if(!t)return(0,x.jsx)(L,{...e});const o=(0,i.d1)(t);return(0,x.jsx)("section",{className:(0,r.A)("row",n),children:o.map(((e,t)=>(0,x.jsx)("article",{className:"col col--6 margin-bottom--lg",children:(0,x.jsx)(y,{item:e})},t)))})}},8453:(e,t,n)=>{n.d(t,{R:()=>s,x:()=>a});var o=n(6540);const r={},i=o.createContext(r);function s(e){const t=o.useContext(i);return o.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:s(e.components),o.createElement(i.Provider,{value:t},e.children)}}}]);