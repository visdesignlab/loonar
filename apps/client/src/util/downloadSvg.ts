import { toSvg } from 'html-to-image';

function inlineComputedStyle(el: HTMLElement) {
    const computed = window.getComputedStyle(el);
    let styleString = '';
    for (let i = 0; i < computed.length; i++) {
        const key = computed[i];
        styleString += `${key}:${computed.getPropertyValue(key)};`;
    }
    el.setAttribute('style', styleString);
}

function inlineAllStyles(root: HTMLElement) {
    // Inline style for the root element.
    inlineComputedStyle(root);
    // Then, inline for all child elements.
    root.querySelectorAll('*').forEach((el) => {
        inlineComputedStyle(el as HTMLElement);
    });
}

export function downloadLineChartSvg(): void {
    const element = document.getElementById('aggLineChartSvg');
    if (!(element instanceof SVGElement)) {
        console.error('SVG element not found!');
        return;
    }
  
    // Create a clone of the SVG element.
    const clone = element.cloneNode(true) as SVGElement;
  
    // Create a hidden container and attach the clone to it.
    const hiddenContainer = document.createElement('div');
    hiddenContainer.style.position = 'absolute';
    hiddenContainer.style.left = '-9999px';
    hiddenContainer.style.top = '-9999px';
    hiddenContainer.appendChild(clone);
    document.body.appendChild(hiddenContainer);
  
    // Inline computed styles on the clone.
    inlineAllStyles(clone as unknown as HTMLElement);
  
    // Convert the cloned SVG to an SVG data URL.
    toSvg(clone as unknown as HTMLElement)
        .then((dataUrl) => {
            const link = document.createElement('a');
            link.download = 'aggregateLineChart.svg';
            link.href = dataUrl;
            link.click();
            // Remove the temporary container.
            document.body.removeChild(hiddenContainer);
        })
        .catch((err) => {
            console.error('oops, something went wrong!', err);
            // Remove the temporary container on error.
            document.body.removeChild(hiddenContainer);
        });
}