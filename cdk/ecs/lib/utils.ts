async function getLatestAdotJavaTag(): Promise<string> {
    const response = await fetch('https://github.com/aws-observability/aws-otel-java-instrumentation/releases/latest', {
        method: 'HEAD',
        redirect: 'follow',
    });

    // Get the final URL after redirects
    const finalUrl = response.url;

    // Extract the tag from the URL
    return finalUrl.split('/').pop() || '';
}

async function getLatestAdotPythonTag(): Promise<string> {
    const response = await fetch(
        'https://github.com/aws-observability/aws-otel-python-instrumentation/releases/latest',
        {
            method: 'HEAD',
            redirect: 'follow',
        },
    );

    // Get the final URL after redirects
    const finalUrl = response.url;

    // Extract the tag from the URL
    return finalUrl.split('/').pop() || '';
}

export { getLatestAdotJavaTag, getLatestAdotPythonTag };
