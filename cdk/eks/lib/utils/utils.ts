import * as fs from 'fs'
import * as yaml from 'js-yaml';

export function transformNameToId(name: string): string {
// Remove the `.yaml` extension
const baseName = name.replace(/\.yaml$/, '');

// Split by `-`, capitalize each part, and join without spaces
const transformedName = baseName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

    return transformedName;
}

export function getYamlFiles(directory: string): string[] {
    return fs.readdirSync(directory).filter((file) => file.endsWith('.yaml'));
}

export function readYamlFile(filePath: string): Record<string, any>[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const documents = yaml.loadAll(content) as Record<string, any>[];
    return documents;
}

// Function that replaces the namespace and account id placeholder with actual values
export function transformYaml(obj: any, accountId: string, region: string, namespace: string, ingressExternalIp: string): any {
    if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                if (key === 'image' && obj[key].startsWith('111122223333.dkr.ecr.us-west-2.amazonaws.com')) {
                    obj[key] = obj[key].replace('111122223333.dkr.ecr.us-west-2.amazonaws.com', `${accountId}.dkr.ecr.${region}.amazonaws.com`);
                } else if (key === 'namespace' && obj[key] === 'namespace') {
                    obj[key] = namespace; 
                } else if (obj[key] === "http://SAMPLE_APP_END_POINT") {
                    obj[key] = `http://${ingressExternalIp}`;
                } else if (obj[key].includes('${REGION}')) {
                    obj[key] = obj[key].replace('${REGION}', region);
                }
            } else if (typeof obj[key] === 'object') {
                transformYaml(obj[key], accountId, region, namespace, ingressExternalIp);
            }
        }
    }
    return obj;
}