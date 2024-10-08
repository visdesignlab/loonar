"use strict";(self.webpackChunkdocs_website=self.webpackChunkdocs_website||[]).push([[431],{7552:(e,n,i)=>{i.r(n),i.d(n,{assets:()=>d,contentTitle:()=>l,default:()=>h,frontMatter:()=>r,metadata:()=>o,toc:()=>a});var t=i(4848),s=i(8453);const r={},l="Building and Running Loon From Source",o={id:"loon-for-developers/building-loon",title:"Building and Running Loon From Source",description:"The official Github repository for Loon has everything that is required to build any of the above docker images. Instead of building a single image, however, you can also use Docker Compose to build our multi-container application. Building the multi-container application instead of the single Docker image provides more insight when attempting to debug and allows for much more configuration. This is done through a build script with an accompanying JSON file.",source:"@site/docs/loon-for-developers/building-loon.md",sourceDirName:"loon-for-developers",slug:"/loon-for-developers/building-loon",permalink:"/loonar/docs/loon-for-developers/building-loon",draft:!1,unlisted:!1,tags:[],version:"current",frontMatter:{},sidebar:"tutorialSidebar",previous:{title:"Developer Quickstart Guide",permalink:"/loonar/docs/loon-for-developers/quickstart"}},d={},a=[{value:"Configuration File",id:"configuration-file",level:2},{value:"General Settings",id:"general-settings",level:3},{value:"MySQL Settings",id:"mysql-settings",level:3},{value:"MinIO Settings",id:"minio-settings",level:3},{value:"NGINX Settings",id:"nginx-settings",level:3},{value:"Local Data Settings",id:"local-data-settings",level:3}];function c(e){const n={code:"code",h1:"h1",h2:"h2",h3:"h3",p:"p",pre:"pre",strong:"strong",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,s.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:"building-and-running-loon-from-source",children:"Building and Running Loon From Source"}),"\n",(0,t.jsx)(n.p,{children:"The official Github repository for Loon has everything that is required to build any of the above docker images. Instead of building a single image, however, you can also use Docker Compose to build our multi-container application. Building the multi-container application instead of the single Docker image provides more insight when attempting to debug and allows for much more configuration. This is done through a build script with an accompanying JSON file."}),"\n",(0,t.jsx)(n.h2,{id:"configuration-file",children:"Configuration File"}),"\n",(0,t.jsx)(n.p,{children:"Below is the base configuration file that is required to build Loon."}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-json",children:'{\n  "generalSettings": {\n    "useHttp": false,\n    "environment": "production",\n    "baseUrl": "localhost"\n  },\n  "mySqlSettings": {\n    "databaseName": "loon",\n    "databaseUser": "user",\n    "databasePassword": "user_pass",\n    "databaseRootPassword": "root_pass"\n  },\n  "minioSettings": {\n    "minioStorageAccessKey": "admin",\n    "minioStorageSecretKey": "minioadmin",\n    "sourceVolumeLocation": "path/to/data"\n  }\n}\n'})}),"\n",(0,t.jsx)(n.h3,{id:"general-settings",children:"General Settings"}),"\n",(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:"Variable"}),(0,t.jsx)(n.th,{children:"Details"}),(0,t.jsx)(n.th,{children:"Possible Values"})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"useHttp"'}),(0,t.jsx)(n.td,{children:"Set to true if using HTTP is desired. If set to false, NGINX settings will be required."}),(0,t.jsx)(n.td,{children:"true/false"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"environment"'}),(0,t.jsx)(n.td,{children:"If set to 'production', will use MinIO features. Setting to 'local' will enable Local Loon instead."}),(0,t.jsx)(n.td,{children:"production/local"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"baseUrl"'}),(0,t.jsx)(n.td,{children:'Base URL for application. Set this to "localhost" when using locally.'}),(0,t.jsx)(n.td,{children:"string"})]})]})]}),"\n",(0,t.jsx)(n.h3,{id:"mysql-settings",children:"MySQL Settings"}),"\n",(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:"Variable"}),(0,t.jsx)(n.th,{children:"Details"}),(0,t.jsx)(n.th,{children:"Possible Values"})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"databaseName"'}),(0,t.jsx)(n.td,{children:"Name of database in mysql to create"}),(0,t.jsx)(n.td,{children:"string"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"databaseUser"'}),(0,t.jsx)(n.td,{children:"Name of standard user"}),(0,t.jsx)(n.td,{children:"string"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"databasePassword"'}),(0,t.jsx)(n.td,{children:"Password for standard user"}),(0,t.jsx)(n.td,{children:"string"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"databaseRootPassword"'}),(0,t.jsx)(n.td,{children:"Password for root user"}),(0,t.jsx)(n.td,{children:"string"})]})]})]}),"\n",(0,t.jsx)(n.h3,{id:"minio-settings",children:"MinIO Settings"}),"\n",(0,t.jsxs)(n.p,{children:["MinIO Settings can be removed when the ",(0,t.jsx)(n.code,{children:"generalSettings.environment"})," is set to ",(0,t.jsx)(n.code,{children:"local"}),"."]}),"\n",(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:"Variable"}),(0,t.jsx)(n.th,{children:"Details"}),(0,t.jsx)(n.th,{children:"Possible Values"})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"minioStorageAccessKey"'}),(0,t.jsx)(n.td,{children:"Username for MinIO administrator"}),(0,t.jsx)(n.td,{children:"string (>3 characters)"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"minioStorageSecretKey"'}),(0,t.jsx)(n.td,{children:"Password for MinIO administrator"}),(0,t.jsx)(n.td,{children:"string (>7 characters)"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"sourceVolumeLocation"'}),(0,t.jsx)(n.td,{children:"Location for the source data to be mounted to the container. This can be any directory with appropriate permissions."}),(0,t.jsx)(n.td,{children:"string"})]})]})]}),"\n",(0,t.jsx)(n.h3,{id:"nginx-settings",children:"NGINX Settings"}),"\n",(0,t.jsxs)(n.p,{children:["NGINX settings can be added by adding ",(0,t.jsx)(n.code,{children:'"nginxSettings"'})," as a top level key. This is only required when ",(0,t.jsx)(n.code,{children:"generalSettings.useHtp"})," is set to ",(0,t.jsx)(n.code,{children:"false"}),"."]}),"\n",(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:"Variable"}),(0,t.jsx)(n.th,{children:"Details"}),(0,t.jsx)(n.th,{children:"Possible Values"})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"sourceVolumeLocation"'}),(0,t.jsx)(n.td,{children:"Location for the ssl keys to be mounted to container."}),(0,t.jsx)(n.td,{children:"string"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"targetVolumeLocation"'}),(0,t.jsx)(n.td,{children:"Location inside container where to mount keys."}),(0,t.jsx)(n.td,{children:"string"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"certFileLocation"'}),(0,t.jsx)(n.td,{children:"Name of cert file relative to source volume mount."}),(0,t.jsx)(n.td,{children:"string"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"keyFileLocation"'}),(0,t.jsx)(n.td,{children:"Name of key file relative to source volume mount"}),(0,t.jsx)(n.td,{children:"string"})]})]})]}),"\n",(0,t.jsx)(n.h3,{id:"local-data-settings",children:"Local Data Settings"}),"\n",(0,t.jsxs)(n.p,{children:["Local Data settings can be added by adding ",(0,t.jsx)(n.code,{children:'"localDataSettings"'})," as a top level key. This is only required when ",(0,t.jsx)(n.code,{children:"generalSettings.environment"})," is set to ",(0,t.jsx)(n.code,{children:'"local"'}),"."]}),"\n",(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:"Variable"}),(0,t.jsx)(n.th,{children:"Details"}),(0,t.jsx)(n.th,{children:"Possible Values"})]})}),(0,t.jsx)(n.tbody,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:'"sourceVolumeLocation"'}),(0,t.jsx)(n.td,{children:"Location for the local data to be mounted to container."}),(0,t.jsx)(n.td,{children:"string"})]})})]}),"\n",(0,t.jsx)(n.p,{children:"The build script will do its best to validate each of these fields before starting the docker container. When running the build script, there are several inputs you can use"}),"\n",(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:"Argument"}),(0,t.jsx)(n.th,{children:"Description"}),(0,t.jsx)(n.th,{children:"Example"})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:"-h, --help"}),(0,t.jsx)(n.td,{children:"Outputs this information to terminal without running script."}),(0,t.jsx)(n.td,{children:"-h"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:"-v, --verbose"}),(0,t.jsx)(n.td,{children:"All output response is sent to the terminal and main log file. If not present, limited information will be passed to the terminal."}),(0,t.jsx)(n.td,{children:"-v"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:"-d, --detached"}),(0,t.jsx)(n.td,{children:"Once all containers are started, program will exit and log in the background"}),(0,t.jsx)(n.td,{children:"-d"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:"-e, --validate-build"}),(0,t.jsx)(n.td,{children:"When present, the script will not build or start any containers. Only the configuration file will be validated and the environment file created."}),(0,t.jsx)(n.td,{children:"-e"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:"--env-file"}),(0,t.jsx)(n.td,{children:"Name of env file to create."}),(0,t.jsx)(n.td,{children:".--env-file .env.production"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:"--config-file"}),(0,t.jsx)(n.td,{children:"Name of config file to use as input"}),(0,t.jsx)(n.td,{children:"--config-file config-test.json"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:"-D, --down"}),(0,t.jsx)(n.td,{children:"Stops all containers and removes all containers. Note that this will not build or start containers nor validate the configuration file."}),(0,t.jsx)(n.td,{children:"-D"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:"-o, --overwrite"}),(0,t.jsx)(n.td,{children:"When set, any settings in your configuration file which are present as environment variables in the current session will be overwritten."}),(0,t.jsx)(n.td,{children:"-o"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:"-s, --disable-spinner"}),(0,t.jsx)(n.td,{children:"When set, disables inline spinner"}),(0,t.jsx)(n.td,{children:"-s"})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:"--prepare-dev"}),(0,t.jsxs)(n.td,{children:["When set, will create the ",(0,t.jsx)(n.code,{children:".env"})," file based on the current configuration that is required to run a separate client development server."]}),(0,t.jsx)(n.td,{children:"--prepare-dev"})]})]})]}),"\n",(0,t.jsxs)(n.p,{children:["In the repository, you will see two docker directories: ",(0,t.jsx)(n.code,{children:"docker"})," and ",(0,t.jsx)(n.code,{children:"docker-local"}),". The main deployment will use the ",(0,t.jsx)(n.code,{children:"docker"})," directory. The ",(0,t.jsx)(n.code,{children:"docker-local"})," directory is a separate local version of Loon which we will discuss shortly. Below are some examples."]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-bash",children:"python3 build.py\n"})}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.strong,{children:"Running Development Server"})}),"\n",(0,t.jsxs)(n.p,{children:["If you'd like to have access to all the development server functionality when working with Loon, you can run a separate development server that connects to the running Docker container. We start by building and running the docker container with the additional flag ",(0,t.jsx)(n.code,{children:"--prepare-dev"}),". This will generate the necessary ",(0,t.jsx)(n.code,{children:".env"})," file in the ",(0,t.jsx)(n.code,{children:"apps/client"})," directory that will be used by the client."]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-bash",children:"python3 build.py --prepare-dev\n"})}),"\n",(0,t.jsxs)(n.p,{children:["Once that has started, navigate to the ",(0,t.jsx)(n.code,{children:"apps/client"})," directory and run the development server."]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-bash",children:"cd apps/client\nyarn run dev\n"})}),"\n",(0,t.jsxs)(n.p,{children:["This will start a separate development server at ",(0,t.jsx)(n.code,{children:"http://localhost:5173"}),". The standard client will still be available as well."]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.strong,{children:"Specifying the env file name and configuration file name"})}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-bash",children:"python3 build.py --env-file .env.production --config-file config-production.json\n"})}),"\n",(0,t.jsx)(n.p,{children:'This will use the "config-production.json" as the input configuration file and output a ".env.production" environment file.'}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.strong,{children:"Using Detached Mode and Verbose"})}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-bash",children:"python3 build.py -vd\n"})}),"\n",(0,t.jsx)(n.p,{children:"This will enable verbose mode so that we can see the build process as it runs. It will also exit once all containers have begun running."}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.strong,{children:"Overwritting configuration file with environment variables"})}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-bash",children:"export LOCALDATASETTINGS_SOURCEVOLUMELOCATION=/Users/MyUser/my-loon-data\npython3 build.py -o\n"})}),"\n",(0,t.jsxs)(n.p,{children:["This will take your current config (in this case ",(0,t.jsx)(n.code,{children:"config.json"})," in the root directory since no file name was specified) and overwrite the ",(0,t.jsx)(n.code,{children:"localDataSettings.sourceVolumeLocation"})," value to be ",(0,t.jsx)(n.code,{children:"/Users/MyUser/my-loon-data"}),". The original ",(0,t.jsx)(n.code,{children:"config.json"})," will not be altered. Instead, a temporary file (in this case named ",(0,t.jsx)(n.code,{children:"config.json.temp"}),") will be created and then used."]}),"\n",(0,t.jsxs)(n.p,{children:['If you\'re using the script not in detached mode, then pressing "Ctrl+C" in the terminal will stop and remove all docker containers. Additionally, all logs will be outputted to a "logs" directory. For each run of the build script, a new directory called ',(0,t.jsx)(n.code,{children:"logs_%Y-%m-%d_%H-%M-%S"})," will be created with logging for each individual service separated."]})]})}function h(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(c,{...e})}):c(e)}},8453:(e,n,i)=>{i.d(n,{R:()=>l,x:()=>o});var t=i(6540);const s={},r=t.createContext(s);function l(e){const n=t.useContext(r);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:l(e.components),t.createElement(r.Provider,{value:n},e.children)}}}]);