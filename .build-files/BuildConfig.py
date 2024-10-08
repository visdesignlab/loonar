import json
import re


def typeMapping(s, reverse=False):
    type_mapping = {
        "boolean": bool,
        "string": str,
        "integer": int
    }

    type_mapping_reverse = {value: key for key, value in type_mapping.items()}

    if not reverse:
        return type_mapping[s]
    else:
        return type_mapping_reverse[s]


def checkDependencies(keyString, valueToCompare, baseConfig, errorOnMatch):
    keyList = keyString.split(".")
    comparedCurrValue = baseConfig[keyList[0]]
    for i in range(1, len(keyList)):
        comparedCurrValue = comparedCurrValue[keyList[i]]

    result = comparedCurrValue == valueToCompare
    if errorOnMatch:
        return result
    else:
        return not result


class BuildValidationError(Exception):
    def __init__(self, message):
        # Call the base class constructor with the parameters it needs
        super().__init__(message)
        # Now for your custom code...


class BuildConfig:
    def __init__(self, configFile, envFile):
        try:
            with open(configFile, 'r') as file:
                self.config = json.load(file)
        except FileNotFoundError:
            raise BuildValidationError(message=f"Cannot find file named '{configFile}'.")
        self.outConfig = {}
        self.errors = []
        self.validate()
        self.envFile = envFile
        # Env File name will be placed in env file for mounting
        self.set('DOCKER_ENV_FILE', envFile)
        self.local = self.get('generalSettings.environment') == 'local'

    def validate(self):
        with open('.build-files/config.json.schema', 'r') as schemaFile:
            self.schema = json.load(schemaFile)

        currConfig = self.config
        currSchema = self.schema
        if self.schema['type'] == "object":
            currSchema = self.schema['properties']
            self.validateCurrConfig(currSchema, currConfig, currStepString='')
        else:
            print('This is not an object')

    def validateCurrConfig(self, currSchema, currConfig, currStepString):
        for key, value in currSchema.items():
            if value['type'] == 'object':
                dependencyCheckPassed = False
                if 'dependentOn' in value:
                    dependencyCheck = checkDependencies(value['dependentOn']['key'],
                                                        value['dependentOn']['value'],
                                                        self.config,
                                                        value['dependentOn']['errorOnMatch']
                                                        )
                    if not dependencyCheck:
                        dependencyCheckPassed = True
                tempSchema = value['properties']

                if not dependencyCheckPassed:
                    try:
                        tempConfig = currConfig[key]
                    except KeyError:
                        tempConfig = {}
                        self.errors.append({
                            'stepString': currStepString,
                            'type': 'missingKey',
                            'schemaKey': key
                        })
                    tempStepString = f'{currStepString}-{key}'
                    self.validateCurrConfig(tempSchema, tempConfig, currStepString=tempStepString)
            else:
                schemaType = value['type']
                if key not in currConfig and value['required'] is True:
                    if 'dependentOn' in value:
                        dependencyCheck = checkDependencies(value['dependentOn']['key'],
                                                            value['dependentOn']['value'],
                                                            self.config,
                                                            value['dependentOn']['errorOnMatch']
                                                            )
                        if dependencyCheck:
                            self.errors.append({
                                'stepString': currStepString,
                                'type': 'missingKey',
                                'schemaKey': key
                            })
                    else:
                        self.errors.append({
                            'stepString': currStepString,
                            'type': 'missingKey',
                            'schemaKey': key
                        })
                elif key in currConfig and type(currConfig[key]) is not typeMapping(schemaType):
                    self.errors.append({
                        'stepString': currStepString,
                        'type': 'incorrectType',
                        'schemaKey': key,
                        'schemaValue': value,
                        'configValue': currConfig[key]
                    })
                elif 'custom' in value:
                    for custom_entry in value['custom']:
                        pattern = re.compile(custom_entry['regexPattern'])
                        matchedPattern = pattern.search(currConfig[key])
                        if custom_entry['errorOnMatch']:
                            if matchedPattern is not None:
                                self.errors.append({
                                    'stepString': currStepString,
                                    'type': 'custom',
                                    'message': custom_entry['message'],
                                    'schemaKey': key
                                })
                        else:
                            if matchedPattern is None:
                                self.errors.append({
                                    'stepString': currStepString,
                                    'type': 'custom',
                                    'message': custom_entry['message'],
                                    'schemaKey': key
                                })

    def set(self, settingName, settingValue, directToEnv=False):
        if not directToEnv:
            self.outConfig[settingName] = settingValue
        else:
            fullEnvFileName = f'.build-files/{self.envFile}'
            with open(fullEnvFileName, 'a') as outF:
                outF.write(f'{settingName}={settingValue}')

    def get(self, keyString):
        keyList = keyString.split(".")
        try:
            currValue = self.config[keyList[0]]
            for i in range(1, len(keyList)):
                currValue = currValue[keyList[i]]
            return currValue
        except KeyError:
            return ""

    def writeToEnv(self):
        outString = ""
        for key, value in self.outConfig.items():
            outString = f'{outString}{key}={value}\n'

        fullEnvFileName = f'.build-files/{self.envFile}'
        with open(fullEnvFileName, 'w') as outF:
            outF.write(outString)

    def reportErrors(self):
        if len(self.errors) == 0:
            print('\nValidated configuration file.\n')
            return
        print('\nEncountered Errors when validating configuration file:\n')
        for entry in self.errors:
            stepString = entry['stepString']
            schemaKey = entry['schemaKey']
            stepStringFormatted = f'{stepString}-{schemaKey}'.lstrip('-').replace('-', '.')
            if entry['type'] == 'missingKey':
                message = f'--> Missing Required Key: {stepStringFormatted}'
            elif entry['type'] == 'incorrectType':
                schemaType = entry['schemaValue']['type']
                configType = typeMapping(type(entry['configValue']), reverse=True)
                message = f'--> Incorrect Type: {stepStringFormatted}' \
                    f' must be "{schemaType}"' \
                    f' but is "{configType}"'
            elif entry['type'] == 'custom':
                errorMessage = entry['message']
                message = f'--> Error at {stepStringFormatted}:' \
                    f' {errorMessage}'
            print(f'{message}\n')
        exit()
