// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title ∅FREQ
/// @notice One non-transferable frequency per wallet. The token holds the recipe,
///         not a recording: the voice genome, the chosen point in the abstraction
///         space and the sigil. The sound is re-rendered from the recipe.
contract ZeroFreq {
    using Strings for uint256;

    string public constant name = "0FREQ";
    string public constant symbol = "FREQ";

    struct Freq {
        bytes32 genomeHash;
        int32[] genome;
        // x noise, y fragmentation, dark, density, space; each 0..1000
        uint16[5] coords;
        string sigil;
        uint64 mintedAt;
    }

    uint256 public totalSupply;
    mapping(uint256 => Freq) private _freqs;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) public tokenOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Frequency(address indexed owner, uint256 indexed tokenId, bytes32 genomeHash, uint16[5] coords);

    error OnePerWallet();
    error Soulbound();
    error UnknownToken();
    error BadCoords();

    function mint(
        bytes32 genomeHash,
        int32[] calldata genome,
        uint16[5] calldata coords,
        string calldata sigil
    ) external returns (uint256 id) {
        if (tokenOf[msg.sender] != 0) revert OnePerWallet();
        for (uint256 i = 0; i < 5; i++) if (coords[i] > 1000) revert BadCoords();

        id = ++totalSupply;
        _owners[id] = msg.sender;
        tokenOf[msg.sender] = id;

        Freq storage f = _freqs[id];
        f.genomeHash = genomeHash;
        f.genome = genome;
        f.coords = coords;
        f.sigil = sigil;
        f.mintedAt = uint64(block.timestamp);

        emit Transfer(address(0), msg.sender, id);
        emit Frequency(msg.sender, id, genomeHash, coords);
    }

    function getFreq(uint256 id) external view returns (Freq memory) {
        if (_owners[id] == address(0)) revert UnknownToken();
        return _freqs[id];
    }

    function ownerOf(uint256 id) external view returns (address owner) {
        owner = _owners[id];
        if (owner == address(0)) revert UnknownToken();
    }

    function balanceOf(address owner) external view returns (uint256) {
        return tokenOf[owner] == 0 ? 0 : 1;
    }

    function tokenURI(uint256 id) external view returns (string memory) {
        if (_owners[id] == address(0)) revert UnknownToken();
        Freq storage f = _freqs[id];
        string memory json = string.concat(
            '{"name":"0FREQ #', id.toString(),
            '","description":"A voice rendered as an abstract frequency. The recording never left the device; this is its recipe.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(f.sigil)), '",',
            '"attributes":[{"trait_type":"genome","value":"', uint256(f.genomeHash).toHexString(32), '"},',
            '{"trait_type":"noise","value":', uint256(f.coords[0]).toString(), '},',
            '{"trait_type":"fragmentation","value":', uint256(f.coords[1]).toString(), '},',
            '{"trait_type":"dark","value":', uint256(f.coords[2]).toString(), '},',
            '{"trait_type":"density","value":', uint256(f.coords[3]).toString(), '},',
            '{"trait_type":"space","value":', uint256(f.coords[4]).toString(), '}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 || id == 0x80ac58cd || id == 0x5b5e139f;
    }

    function approve(address, uint256) external pure { revert Soulbound(); }
    function setApprovalForAll(address, bool) external pure { revert Soulbound(); }
    function getApproved(uint256) external pure returns (address) { return address(0); }
    function isApprovedForAll(address, address) external pure returns (bool) { return false; }
    function transferFrom(address, address, uint256) external pure { revert Soulbound(); }
    function safeTransferFrom(address, address, uint256) external pure { revert Soulbound(); }
    function safeTransferFrom(address, address, uint256, bytes calldata) external pure { revert Soulbound(); }
}
