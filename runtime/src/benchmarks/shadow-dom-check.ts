import { Window } from 'happy-dom';
import { performance } from 'perf_hooks';

console.log('--- HappyDOM Shadow DOM Capability Check ---');

async function checkShadowDOM() {
    const window = new Window();
    const document = window.document;
    const body = document.body;

    // 1. Basic Creation
    const host = document.createElement('div');
    host.id = 'app-root';
    body.appendChild(host);

    console.log('[Check 1] attachShadow API exists:', typeof host.attachShadow === 'function');

    if (typeof host.attachShadow !== 'function') {
        console.error('❌ HappyDOM does not support attachShadow!');
        return;
    }

    // 2. Closed Mode Isolation
    const shadowRoot = host.attachShadow({ mode: 'closed' });
    console.log('[Check 2] shadowRoot is closed (host.shadowRoot should be null):', host.shadowRoot === null);

    // 3. Render Content inside Shadow
    const innerDiv = document.createElement('div');
    innerDiv.id = 'inner-secret';
    innerDiv.className = 'secret-class';
    shadowRoot.appendChild(innerDiv);

    // 4. Query Isolation Test
    const queriedId = document.getElementById('inner-secret');
    const queriedClass = document.querySelector('.secret-class');

    console.log('[Check 3] Query Isolation (ID):', queriedId === null ? 'Pass' : 'Fail');
    console.log('[Check 4] Query Isolation (Class):', queriedClass === null ? 'Pass' : 'Fail');

    // 5. Event Retargeting Test (Mock Event)
    let eventTargetCorrect = false;
    host.addEventListener('click', (e) => {
        // When clicking inside shadow, target should be retargeted to host
        // HappyDOM might simulate this if we dispatch event on innerDiv
        console.log('[Check 5 Debug] Click target:', (e.target as any).id || (e.target as any).tagName);
        eventTargetCorrect = (e.target === host);
    });

    // Create and dispatch event inside shadow
    const event = new window.MouseEvent('click', { bubbles: true, composed: true });
    innerDiv.dispatchEvent(event);

    console.log('[Check 5] Event Retargeting:', eventTargetCorrect ? 'Pass' : 'Fail');

    window.close();
}

checkShadowDOM();
