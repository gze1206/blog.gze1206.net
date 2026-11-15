/**
 * 발행을 확정한 뒤의 안내 (NOR-210). 앱은 push 하지 않는다. 호스트의 릴레이가 산출물을 검사해
 * content 브랜치로 보내고, GitHub 이 PR 을 만들어 CI 가 통과하면 자동으로 병합한다.
 */
export function PublishHandoff({ exportRef }: { readonly exportRef: string }) {
  return (
    <>
      <p>
        발행을 맡겼습니다(<code className="font-mono">{exportRef}</code>).
      </p>
      <p className="mt-2">
        1분 안에 블로그 저장소에 PR 이 열리고, 검사를 통과하면 자동으로 병합되어 블로그에
        반영됩니다. 검사가 실패하거나 콘텐츠 밖의 변경이 섞이면 PR 이 열린 채로 남거나 전달되지
        않습니다.
      </p>
    </>
  );
}
