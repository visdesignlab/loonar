import { OrthographicController } from '@deck.gl/core';

export class ScrollUpDownController extends OrthographicController {
    constructor(props: any) {
        super(props);
    }

    handleEvent(event: any) {

        if (event.type === 'wheel') {
            const delta = event.delta;
            this.onScroll(delta);
            event.preventDefault();
        }
    }

    setProps(props: any) {
        super.setProps(props);
        this.onScroll = props.onScroll;
    }
}
