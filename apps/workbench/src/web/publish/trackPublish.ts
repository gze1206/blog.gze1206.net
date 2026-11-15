/** 확정한 발행을 진행 토스트(NOR-228)에 알리는 이벤트. 어느 화면에서든 부를 수 있다. */
export const PUBLISH_STARTED_EVENT = 'workbench:publish-started';

export function trackPublish(ref: string, title: string): void {
  window.dispatchEvent(new CustomEvent(PUBLISH_STARTED_EVENT, { detail: { ref, title } }));
}
