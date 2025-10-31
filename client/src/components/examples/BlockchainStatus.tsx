import BlockchainStatus from '../BlockchainStatus';

export default function BlockchainStatusExample() {
  return (
    <div className="p-6 space-y-4 bg-background">
      <BlockchainStatus blockCount={42} isValid={true} />
      <BlockchainStatus blockCount={43} isValidating={true} />
      <BlockchainStatus blockCount={44} isValid={false} />
    </div>
  );
}
