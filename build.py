import subprocess
import re
import argparse
import sys
import time
import signal
import threading
import logging
import os
from datetime import datetime
import shutil
import json

sys.path.append(os.path.join(os.path.dirname(__file__), '.build-files'))
import BuildConfig  # type: ignore


def set_value_in_dict(key_entry_list, curr_dict, new_value):

    valid_booleans = {'true', 'false'}
    lower_s = new_value.lower()

    if lower_s in valid_booleans:
        new_value = lower_s == 'true'
    else:
        try:
            new_value = int(new_value)
        except ValueError:
            pass

    curr_dict = curr_dict[key_entry_list[0]]
    for i in range(1, len(key_entry_list)-1):
        curr_dict = curr_dict[key_entry_list[i]]

    curr_dict[key_entry_list[len(key_entry_list)-1]] = new_value


def generate_possible_key_list(json_dict, key_list, prepend_string=""):
    for key, value in json_dict.items():
        if isinstance(value, dict):
            curr_prepend_string = f'{prepend_string}{key}_'
            generate_possible_key_list(value, key_list, prepend_string=curr_prepend_string)
        else:
            key_list.append(f'{prepend_string}{key}')


def overwrite_config(config_file):
    print('Overwriting with local variables:\n')
    with open(config_file, 'r') as cf:
        config_dict = json.load(cf)
        total_key_list = []
        generate_possible_key_list(config_dict, total_key_list)
    count = 0
    for item in total_key_list:
        # Get uppercase version and check if in environ
        curr_env_value = os.getenv(item.upper())
        if curr_env_value is not None:
            count += 1
            print(f"{item.upper()}={curr_env_value}")
            # Used to get value in config dict
            key_entry_list = item.split("_")

            set_value_in_dict(key_entry_list, config_dict, curr_env_value)
    if count == 0:
        print("No variables to overwrite.")
        return config_file
    else:
        new_config_file_name = f"{config_file}.temp"
        with open(new_config_file_name, 'w') as cfw:
            json.dump(config_dict, cfw, indent=4)
        return new_config_file_name


def createComposeFile(local=False, nfs=False):
    docker_compose_template = '.build-files/docker-compose.template.yml'
    if local:
        docker_compose_template = '.build-files/docker-compose-local.template.yml'
    elif nfs:
        docker_compose_template = '.build-files/docker-compose-nfs.template.yml'

    shutil.copy(docker_compose_template, '.build-files/docker-compose.yml')


def createEnvFile(configFileName, envFileName, useDid=False):
    buildConfig = BuildConfig.BuildConfig(configFileName, envFileName)
    buildConfig.reportErrors()

    # --------------------------------------------------------------
    # GENERAL SETTINGS ---------------------------------------------
    # --------------------------------------------------------------
    # general_settings = buildConfig.get('generalSettings')
    use_http = buildConfig.get('generalSettings.useHttp')
    base_url = buildConfig.get('generalSettings.baseUrl')
    environment = buildConfig.get('generalSettings.environment')

    buildConfig.set('USE_HTTP', use_http) 

    if environment != 'local':
        if use_http:
            nginx_file = 'nginx-http.conf'
            minio_browser_redirect_url = f'http://{base_url}/minio'
        else:
            nginx_file = 'nginx-https.conf'
            minio_browser_redirect_url = f'https://{base_url}/minio'
        buildConfig.set('MINIO_BROWSER_REDIRECT_URL', minio_browser_redirect_url)
    else:
        nginx_file = 'nginx-http-local.conf'

    buildConfig.set('NGINX_FILE', nginx_file)

    buildConfig.set('VITE_ENVIRONMENT', environment)
    buildConfig.set('VITE_SERVER_URL', f'{base_url}/data')

    localPort1 = buildConfig.get("generalSettings.local_port_1")
    buildConfig.set("LOCAL_PORT_1", localPort1)
    localPort2 = buildConfig.get("generalSettings.local_port_2")
    buildConfig.set("LOCAL_PORT_2", localPort2)

    data_port = buildConfig.get("generalSettings.data_port")
    buildConfig.set("DATA_PORT", data_port)
    ws_port = buildConfig.get("generalSettings.ws_port")
    buildConfig.set("WS_PORT", ws_port)

    # --------------------------------------------------------------
    # MYSQL SETTINGS -----------------------------------------------
    # --------------------------------------------------------------

    # my_sql_settings = buildConfig.config.get('mySqlSettings')

    buildConfig.set('DATABASE_ROOT_PASSWORD', buildConfig.get('mySqlSettings.databaseRootPassword'))
    buildConfig.set('DATABASE_PASSWORD', buildConfig.get('mySqlSettings.databasePassword'))
    buildConfig.set('DATABASE_USER', buildConfig.get('mySqlSettings.databaseUser'))
    buildConfig.set('DATABASE_NAME', buildConfig.get('mySqlSettings.databaseName'))

    buildConfig.set('DATABASE_HOST', 'db')
    buildConfig.set('DATABASE_PORT', '3306')

    # --------------------------------------------------------------
    # CELERY SETTINGS ----------------------------------------------
    # --------------------------------------------------------------

    buildConfig.set('CELERY_BROKER_URL', 'redis://redis:6379/0')
    buildConfig.set('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')

    # --------------------------------------------------------------
    # MINIO SETTINGS -----------------------------------------------
    # --------------------------------------------------------------

    # minio_settings = buildConfig.config.get('minioSettings')
    if buildConfig.get('minioSettings') != "":

        buildConfig.set('MINIO_STORAGE_ACCESS_KEY', buildConfig.get(
            'minioSettings.minioStorageAccessKey'
            ))
        buildConfig.set('MINIO_STORAGE_SECRET_KEY', buildConfig.get(
            'minioSettings.minioStorageSecretKey'
            ))
        buildConfig.set('MINIO_VOLUME_LOCATION',
                        buildConfig.get('minioSettings.sourceVolumeLocation'))

        buildConfig.set('MINIO_STORAGE_ENDPOINT', 'minio:9000')
        buildConfig.set('MINIO_STORAGE_MEDIA_BUCKET_NAME', 'data')
        buildConfig.set('MINIO_STORAGE_STATIC_BUCKET_NAME', 'static')
        buildConfig.set('MINIO_STORAGE_MEDIA_URL', f'{base_url}/data')
        buildConfig.set('MINIO_STORAGE_STATIC_URL', f'{base_url}/data')
        if buildConfig.nfs is True:
            buildConfig.set('MINIO_NFS_VERSION',
                            buildConfig.get('minioSettings.nfsVersion'))
            buildConfig.set('MINIO_NFS_IP_ADDRESS',
                            buildConfig.get('minioSettings.ipAddress'))
            buildConfig.set('MINIO_NFS_USER_GROUP',
                            buildConfig.get('minioSettings.userGroupPermissions'))

    # --------------------------------------------------------------
    # NGINX SETTINGS -----------------------------------------------
    # --------------------------------------------------------------

    if buildConfig.get('nginxSettings') != "":
        ssl_mapping = f"{buildConfig.get('nginxSettings.sourceVolumeLocation')}" \
                      f":{buildConfig.get('nginxSettings.targetVolumeLocation')}:ro"
        buildConfig.set('SSL_MAPPING', ssl_mapping)
        buildConfig.set('SSL_CERT_FILE', buildConfig.get('nginxSettings.certFileLocation'))
        buildConfig.set('SSL_KEY_FILE', buildConfig.get('nginxSettings.keyFileLocation'))
        buildConfig.set('SSL_TARGET_MOUNTED_DIRECTORY',
                        buildConfig.get('nginxSettings.targetVolumeLocation'))
        buildConfig.set('SSL_SOURCE_MOUNTED_DIRECTORY',
                        buildConfig.get('nginxSettings.sourceVolumeLocation'))

    # --------------------------------------------------------------
    # OTHER SETTINGS -----------------------------------------------
    # --------------------------------------------------------------

    minio_enabled = True if environment == 'production' else False
    buildConfig.set('MINIO_ENABLED', minio_enabled)
    buildConfig.set('DEBUG', True)
    buildConfig.set('ALLOWED_HOST', f"'{base_url}'")
    buildConfig.set('SECRET_KEY',
                    '"django-insecure-z2^vruu347=0e-qyh%&k)%*j9(hgubj$layg&k$-vwb1u+mp93"'
                    )
    localVolumeLocation = buildConfig.get('localDataSettings.sourceVolumeLocation')
    buildConfig.set('LOCAL_DATA_VOLUME_LOCATION', localVolumeLocation)

    if useDid is True:
        buildConfig.set('MIGRATIONS_SOURCE', 'migrations_volume')
    else:
        buildConfig.set('MIGRATIONS_SOURCE', '../apps/server/api/migrations')

    buildConfig.writeToEnv()
    return buildConfig


def run_command(command, shell=True):
    """ Run a shell command and capture its output. """

    process = subprocess.Popen(
        command,
        encoding='utf-8',
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    for line in iter(process.stdout.readline, ''):
        try:
            logging.info(line.strip())  # Log the line
        except UnicodeEncodeError:
            # Replace invalid characters
            logging.info(line.encode('utf-8', 'replace').decode('utf-8').strip())
    for line in iter(process.stderr.readline, ''):
        try:
            logging.info(line.strip())  # Log the line
        except UnicodeEncodeError:
            # Replace invalid characters
            logging.info(line.encode('utf-8', 'replace').decode('utf-8').strip())

    return process


def follow_logs(service_name, logs_path, verbose=False, detached=False):
    file_name = f"{logs_path}/{service_name}.log"
    if detached:
        command = f'docker-compose -f .build-files/docker-compose.yml logs -f {service_name}' \
                f' >> {file_name} 2>&1 &'
        subprocess.Popen(
            command,
            shell=True,
            encoding='utf-8',
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True
        )
    else:
        command = f'docker-compose -f .build-files/docker-compose.yml logs -f {service_name}'
        process = subprocess.Popen(
            command,
            shell=True,
            encoding='utf-8',
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
            text=True
        )
        with open(file_name, 'w') as f:

            for line in iter(process.stdout.readline, ''):
                clean_line = strip_ansi_escape_codes(line)
                f.write(clean_line)  # Clean line of ASCII characters
                f.flush()
                if verbose:
                    try:
                        logging.info(line.strip())  # Log the line
                    except UnicodeEncodeError:
                        # Replace invalid characters
                        logging.info(line.encode('utf-8', 'replace').decode('utf-8').strip())
            for line in iter(process.stderr.readline, ''):
                clean_line = strip_ansi_escape_codes(line)
                f.write(clean_line)  # Write cleaned line to file
                f.flush()  # Ensure the line is written to the file immediately
                if verbose:
                    try:
                        logging.info(line.strip())  # Log the line
                    except UnicodeEncodeError:
                        # Replace invalid characters
                        logging.info(line.encode('utf-8', 'replace').decode('utf-8').strip())

            process.stdout.close()
            process.stderr.close()

    # Optionally send std error to subprocess.PIPE and then take STDERR and log to error file


def build_containers(env_file, disable_spinner=False):
    global stop_spinner
    if not disable_spinner:
        stop_spinner = False
        """ Build the containers. """
        spinner_thread = threading.Thread(target=spinner, args=("Building containers...",))
        spinner_thread.start()
    else:
        print("Building containers...")

    process = run_command(f"docker-compose -f .build-files/docker-compose.yml"
                          f" --env-file {env_file} build")
    process.wait()  # Wait for the build to complete

    if not disable_spinner:
        stop_spinner = True
        spinner_thread.join()  # Ensure spinner thread completes
        print("\nBuild complete.")  # Print new line after spinner stops
    else:
        print("Build Complete.")


def follow_all_logs(logs_path, services, verbose=False, detached=False):
    for service in services:
        log_thread = threading.Thread(target=follow_logs, args=(service,
                                                                logs_path,
                                                                verbose,
                                                                detached))
        log_thread.daemon = True
        log_thread.start()


def start_containers(env_file, disable_spinner=False):
    global stop_spinner
    if not disable_spinner:
        stop_spinner = False
        """ Start the containers in detached mode. """
        spinner_thread = threading.Thread(target=spinner, args=("Starting containers...",))
        spinner_thread.start()
    else:
        print("Starting containers...")
    process = run_command(f"docker-compose -f .build-files/docker-compose.yml"
                          f" --env-file {env_file} up -d")

    process.wait()  # Wait for the containers to start

    if not disable_spinner:
        stop_spinner = True
        spinner_thread.join()  # Ensure spinner thread completes
        print("\nContainers started.")
    else:
        print("Build Complete.")


def check_containers_status(services, detached=False):
    """ Check and print the status of each container. """
    while True:
        print("Checking container statuses...")
        result = subprocess.run(
            [
                "docker-compose",
                "-f",
                ".build-files/docker-compose.yml",
                "ps",
                "--services",
                "--filter",
                "status=running"
            ],
            capture_output=True,
            text=True
        )
        running_services = result.stdout.strip().split('\n')
        number_of_services = len(services)
        if len(running_services) == number_of_services:  # Number of containers
            print("All containers are running.")
            if not detached:
                time.sleep(5)
            else:
                break
        else:
            print(f"Running containers: {running_services}")
            time.sleep(5)  # Wait before checking again


def cleanup_and_exit(signal=None, frame=None):
    """ Stop all Docker containers and exit gracefully. """
    print("\nCleaning up and stopping containers...")
    subprocess.run("docker-compose -f .build-files/docker-compose.yml down", shell=True)
    sys.exit(0)


def prepare_dev(buildConfig):
    vite_server_url = f"{buildConfig.get('generalSettings.baseUrl')}/data"
    vite_use_http = f"{buildConfig.get('generalSettings.useHttp')}"
    vite_environment = f"{buildConfig.get('generalSettings.environment')}"

    outString = f"VITE_SERVER_URL={vite_server_url}\n" \
                f"VITE_USE_HTTP={vite_use_http}\n" \
                f"VITE_ENVIRONMENT={vite_environment}\n"

    fullEnvFileName = 'apps/client/.env'
    with open(fullEnvFileName, 'w') as outF:
        outF.write(outString)
    print("Dev server can now be run by using 'yarn run dev' in the apps/client directory.")


def strip_ansi_escape_codes(text):
    # Regex to match ANSI escape codes
    ansi_escape = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')
    return ansi_escape.sub('', text)


def spinner(msg):
    """ Display a spinning cursor to indicate ongoing processes. """
    spinner_chars = ['|', '/', '-', '\\']
    idx = 0
    while not stop_spinner:
        print(f'\r{msg} {spinner_chars[idx % len(spinner_chars)]}', end='')
        idx += 1
        time.sleep(0.1)


if __name__ == "__main__":
    global stop_spinner
    stop_spinner = False

    parser = argparse.ArgumentParser(description="Script description")
    parser.add_argument("--env-file", type=str, required=False,
                        default=".env", help="Name of environment file created.")
    parser.add_argument("--config-file", type=str, required=False,
                        default="config.json", help="Name of config file to pull from.")
    parser.add_argument("-v", "--verbose", action='store_true',
                        help="Increased terminal logging output.")
    parser.add_argument("-d", "--detached", action='store_true', help="Detached mode.")
    parser.add_argument("-D", "--down", action="store_true", help="Shuts down docker containers.")
    parser.add_argument("-e", "--validate-build", action="store_true",
                        help="If present, only validates configuration file and generates"
                        "corresponding environment file.")
    parser.add_argument("-o", "--overwrite", action="store_true",
                        help="If present, overwrites chosen config with current env variables")
    parser.add_argument("-s", "--disable-spinner", action="store_true", required=False,
                        help="Disables spinner")
    parser.add_argument("--prepare-dev", action="store_true", required=False,
                        help="Generates .env file for client environment.")
    parser.add_argument("-i", "--use-did", action="store_true", required=False,
                        help="Flag to specify that this build script is running in a DiD setup.")

    args = parser.parse_args()

    config_file_name = args.config_file

    if not args.validate_build:
        if not args.down:
            # Create the env file, returning the build config
            if args.overwrite:
                config_file_name = overwrite_config(config_file_name)

            # Clear env file
            try:
                os.remove('apps/client/.env')
                print('Cleared old .env file.')
            except FileNotFoundError:
                print('No client .env file found.')
                pass

            buildConfig = createEnvFile(config_file_name, args.env_file, args.use_did)

            use_http = buildConfig.get('generalSettings.useHttp')
            if use_http:
                http_value = 'http://'
            else:
                http_value = 'https://'

            base_url = buildConfig.get('generalSettings.baseUrl')

            # Generate docker-compose file based on if we are using local loon or not
            createComposeFile(local=buildConfig.local, nfs=buildConfig.nfs)

            if buildConfig.local:
                services = ["db", "client", "server", "data", "celery", "redis", "duckdb"]
            else:
                services = ["db", "client", "server", "minio", "celery", "redis", "duckdb"]

            # Get current time and create unique logs path
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            logs_path = f'logs/logs_{timestamp}'
            full_output_path = f'{logs_path}/out.log'
            os.makedirs(f'logs/logs_{timestamp}', exist_ok=True)

            handlers = [logging.FileHandler(full_output_path)]

            # Update the default encoding for stdout to utf-8
            sys.stdout.reconfigure(encoding='utf-8')

            # If verbose, add additional handler to output info to terminal
            if args.verbose:
                handlers.append(logging.StreamHandler(sys.stdout))

            logging.basicConfig(
                level=logging.INFO,
                format='%(asctime)s - %(levelname)s - %(message)s',
                handlers=handlers
            )

            # Bind Ctrl+C to cleanup
            signal.signal(signal.SIGINT, cleanup_and_exit)

            # Build, run, then follow all logs. Begin monitoring process
            build_containers(f'.build-files/{args.env_file}', args.disable_spinner)
            start_containers(f'.build-files/{args.env_file}', args.disable_spinner)
            print(f"Visit {http_value}{base_url} to view application.\n")
            follow_all_logs(logs_path, services, args.verbose, args.detached)

            if args.prepare_dev:
                prepare_dev(buildConfig)

            check_containers_status(services, args.detached)
        else:
            cleanup_and_exit()
    else:
        if args.overwrite:
            config_file_name = overwrite_config(config_file_name)

        buildConfig = createEnvFile(config_file_name, args.env_file, args.use_did)
        createComposeFile(local=buildConfig.local, nfs=buildConfig.nfs)
