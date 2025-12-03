import BlockItem from '../BlockItem';

export default function BlockItemExample() {
  return (
    <div className="p-6 bg-background space-y-0 max-w-2xl">
      <BlockItem
        index={0}
        hash="0000000000000000000000000000000000000000000000000000000000000000"
        prevHash="0"
        timestamp="2025-01-01 00:00:00"
        from="system"
        to="all"
        payload="Genesis Block"
      />
      <BlockItem
        index={1}
        hash="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
        prevHash="0000000000000000000000000000000000000000000000000000000000000000"
        timestamp="2025-01-01 10:30:15"
        from="alice"
        to="bob"
        payload="Hello Bob! This is a blockchain message."
      />
      <BlockItem
        index={2}
        hash="f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2"
        prevHash="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
        timestamp="2025-01-01 10:31:42"
        from="bob"
        to="alice"
        payload="Hi Alice! The chain is working perfectly."
      />
    </div>
  );
}
