// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MatChainRegistry {
    struct Discovery {
        bytes32 fingerprint;
        address creator;
        uint256 blockNumber;
        string ipfsCid;
        string metadata;
        bool verified;
    }

    mapping(bytes32 => Discovery) public discoveries;
    mapping(address => uint256) public validatorStake;
    bytes32[] public discoveryHashes;
    address public immutable owner;

    uint256 public constant VALIDATION_STAKE = 0.05 ether;

    event DiscoveryRegistered(bytes32 indexed fingerprint, address indexed creator, uint256 blockNumber);
    event DiscoveryVerified(bytes32 indexed fingerprint, bool verified);
    event DiscoveryAttested(bytes32 indexed fingerprint, address indexed validator, uint256 stake);
    event StakeWithdrawn(address indexed validator, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function registerDiscovery(bytes32 fingerprint, string memory ipfsCid, string memory metadata) external {
        require(discoveries[fingerprint].creator == address(0), 'Already registered');
        discoveries[fingerprint] = Discovery({
            fingerprint: fingerprint,
            creator: msg.sender,
            blockNumber: block.number,
            ipfsCid: ipfsCid,
            metadata: metadata,
            verified: false
        });
        discoveryHashes.push(fingerprint);
        emit DiscoveryRegistered(fingerprint, msg.sender, block.number);
    }

    function verifyDiscovery(bytes32 fingerprint) external payable {
        require(discoveries[fingerprint].creator != address(0), 'Unknown discovery');
        require(!discoveries[fingerprint].verified, 'Already verified');
        require(msg.value == VALIDATION_STAKE, 'Incorrect validation stake');
        validatorStake[msg.sender] += msg.value;
        discoveries[fingerprint].verified = true;
        emit DiscoveryAttested(fingerprint, msg.sender, msg.value);
        emit DiscoveryVerified(fingerprint, true);
    }

    function withdrawStake() external {
        uint256 amount = validatorStake[msg.sender];
        require(amount > 0, 'No stake to withdraw');
        validatorStake[msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, 'Stake withdrawal failed');
        emit StakeWithdrawn(msg.sender, amount);
    }

    function getDiscoveryCount() external view returns (uint256) {
        return discoveryHashes.length;
    }
}
