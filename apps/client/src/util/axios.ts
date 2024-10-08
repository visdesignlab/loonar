import S3FileFieldClient from 'django-s3-file-field';
import axios, {
    type AxiosInstance,
    type AxiosPromise,
    type AxiosRequestConfig,
    type AxiosResponse,
} from 'axios';
import type { LocationConfig } from '../stores/componentStores/uploadStore';

interface LoonAxiosInstance extends AxiosInstance {
    upload(file: File): Promise<string>;
    process(
        fieldValue: string,
        workflow_code: string,
        file_type: string,
        file_name: string,
        location: string,
        experiment_name: string
    ): AxiosPromise<ProcessResponseData>;
    checkForUpdates(task_id: string): AxiosPromise<StatusResponseData>;
    createExperiment(
        experiment_name: string,
        experiment_settings: LocationConfig[],
        experiment_headers: string[] | null,
        experiment_transforms: Record<string, string> | null,
        location_tags: Record<string, Record<string, string>>
    ): AxiosPromise<CreateExperimentResponseData>;
    verifyExperimentName(
        experiment_name: string
    ): AxiosPromise<VerifyExperimentNameResponseData>;
}

export interface StatusResponseData {
    status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ERROR';
    message: string;
    data?: Record<string, any>;
}

export interface ProcessResponseData {
    status: 'SUCCEEDED' | 'FAILED';
    message: string;
    task_id?: string;
}

export interface CreateExperimentResponseData {
    status: string;
    message?: string;
}

export interface VerifyExperimentNameResponseData {
    status: string;
}

export function createLoonAxiosInstance(
    config: AxiosRequestConfig
): LoonAxiosInstance {
    const axiosInstance = axios.create(config);
    const Proto = Object.getPrototypeOf(axiosInstance);

    // Upload function
    Proto.upload = async function (file: File): Promise<string> {
        // Create new S3FileField Client
        const s3ffClient = new S3FileFieldClient({
            baseUrl: `${this.defaults.baseURL}/s3-upload/`,
            apiConfig: this.defaults,
        });
        // Upload straight to Minio and get back the FieldValue
        const fieldValue = await s3ffClient.uploadFile(
            file,
            'api.LoonUpload.blob'
        );
        return fieldValue.value;
    };

    Proto.process = async function (
        fieldValue: string,
        workflow_code: string,
        file_type: string,
        file_name: string,
        location: string,
        experiment_name: string
    ): AxiosPromise<ProcessResponseData> {
        return this.post(`${this.defaults.baseURL}/process/`, {
            field_value: fieldValue,
            workflow_code,
            file_type,
            file_name,
            location,
            experiment_name,
        });
    };

    Proto.checkForUpdates = async function (
        task_id: string
    ): AxiosPromise<StatusResponseData> {
        return this.get(`${this.defaults.baseURL}/process/${task_id}`);
    };

    Proto.createExperiment = async function (
        experiment_name: string,
        experiment_settings: LocationConfig[],
        experiment_headers: string[],
        experiment_header_transforms: Record<string, string>,
        location_tags: Record<string, Record<string, string>>
    ): AxiosPromise<CreateExperimentResponseData> {
        const formData = new FormData();
        formData.append('experimentName', experiment_name);
        formData.append(
            'experimentSettings',
            JSON.stringify(experiment_settings)
        );
        formData.append(
            'experimentHeaders',
            JSON.stringify(experiment_headers)
        );
        formData.append(
            'experimentHeaderTransforms',
            JSON.stringify(experiment_header_transforms)
        );
        formData.append('locationTags', JSON.stringify(location_tags));

        return this.post(
            `${this.defaults.baseURL}/createExperiment/`,
            formData
        );
    };

    Proto.verifyExperimentName = async function (
        experiment_name: string
    ): AxiosPromise<VerifyExperimentNameResponseData> {
        return this.get(
            `${this.defaults.baseURL}/verifyExperimentName/${experiment_name}`
        );
    };
    axiosInstance.interceptors.response.use(
        (response) => response,
        (error) => {
            if (error.response) {
                if (error.response.status === 401) {
                    console.error('Unauthorized');
                } else if (error.response.status === 500) {
                    console.error('There was an internal server error');
                }
            } else if (error.request) {
                console.error('Network Error: ', error.request);
            } else {
                console.error('There was an unkown error: ', error.message);
            }
            return Promise.reject(error);
        }
    );

    return axiosInstance as LoonAxiosInstance;
}
