import { toSvg } from 'html-to-image';

function inlineComputedStyle(el: HTMLElement) {
    const computed = window.getComputedStyle(el);
    let styleString = '';
    // For each property in the computed style, add it to the style string
    for (let i = 0; i < computed.length; i++) {
        const key = computed[i];
        styleString += `${key}:${computed.getPropertyValue(key)};`;
    }
    // Set the style attribute of the element to the computed style string
    el.setAttribute('style', styleString);
}

// Inline all styles for the root element and its children.
function inlineAllStyles(root: HTMLElement) {
    // Inline style for the root element.
    inlineComputedStyle(root);
    // Then, inline for all child elements.
    root.querySelectorAll('*').forEach((el) => {
        inlineComputedStyle(el as HTMLElement);
    });
}

export function downloadLineChartSvg(
    attribute: string,
    aggregation: string
): void {
    // Ensure the first letter of attribute and aggregation is capitalized.
    attribute = attribute.charAt(0).toUpperCase() + attribute.slice(1);
    aggregation = aggregation.charAt(0).toUpperCase() + aggregation.slice(1);

    const element = document.getElementById('aggLineChartSvg');
    if (!(element instanceof SVGElement)) {
        console.error('SVG element not found!');
        return;
    }

    // Create a clone of the SVG element.
    const clone = element.cloneNode(true) as SVGElement;

    // Remove hovered‐time and current‐time lines from the clone
    clone
        .querySelectorAll('.hovered.time.agg-line, .current.time.agg-line')
        .forEach((el) => el.remove());

    // Create a hidden container and attach the clone to it.
    const hiddenContainer = document.createElement('div');
    Object.assign(hiddenContainer.style, {
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
    });
    hiddenContainer.appendChild(clone);
    document.body.appendChild(hiddenContainer);

    // Inline computed styles on the clone.
    inlineAllStyles(clone as unknown as HTMLElement);

    // Convert the cloned SVG to an SVG data URL.
    toSvg(clone as unknown as HTMLElement)
        .then((dataUrl) => {
            const link = document.createElement('a');
            link.download = `Loon_${aggregation}_${attribute}_Line_Chart.svg`;
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
