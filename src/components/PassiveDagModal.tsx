import * as React from 'react';
import ReactModal from 'react-modal';

import Graph from './Graph'
import { Dag } from '../model/dag';
import { assert } from '../model/util';
import { PassiveDagAside } from './PassiveDagAside';
import { Literal } from '../model/literal';

import { passiveDagForSelection } from '../model/transformations';
import { VizWrapper } from '../model/viz-wrapper';

ReactModal.setAppElement('#root');

type Props = {
	dag: Dag,
	nodeSelection: number[],
  currentTime: number,
	
	changedNodesEvent?: Set<number>,
  infoToggle: boolean,
  editToggle: boolean,
  onLiteralOrientationChange: (nodeId: number, oldPosition: ["premise" | "conclusion" | "context", number], newPosition: ["premise" | "conclusion" | "context", number]) => void,
  onLiteralRepresentationChange: (nodeId: number, literal: Literal) => void

	onDismissPassiveDag: (selectedId: number | null, positioningHint: [number, number] | null) => void,
  onToggleInfo: () => void,
  onToggleEdit: () => void
};

type State = {
	passiveDag: Dag | null;
  nodeSelectionPassiveDag: number[],
}

export class PassiveDagModal extends React.Component<Props, State> {
	
	state: State = {
		passiveDag: null,
		nodeSelectionPassiveDag: []
  }

  async componentDidMount() {
    const passiveDag = await this.generatePassiveDag();
    this.setState({
      passiveDag: passiveDag
    });
  }

  async componentDidUpdate(previousProps) {
		if (this.props.dag !== previousProps.dag || this.props.nodeSelection !== previousProps.nodeSelection || this.props.currentTime !== previousProps.currentTime) {
			const passiveDag = await this.generatePassiveDag();
			this.setState({
				passiveDag: passiveDag
			});
		}
  }

	render() {
		if (this.state.passiveDag === null) {
			return (
				<section>Layouting...</section>
			)
		}

		return (
			<ReactModal
				isOpen={true}
				contentLabel={`Clauses currently in Passive generated by clause with id ${this.state.passiveDag!.activeNodeId!}`}
				onRequestClose={() => {
					this.props.onDismissPassiveDag(null, null);
				}}
			>
				<Graph
					dag={this.state.passiveDag!}
					nodeSelection={this.state.nodeSelectionPassiveDag}
					changedNodesEvent={this.props.changedNodesEvent}
					currentTime={this.props.currentTime}
					animateDagChanges={false}
					onNodeSelectionChange={this.nodeSelectionChange.bind(this)}
					onUpdateNodePositions={this.updateNodePositions.bind(this)}
				/>
				<PassiveDagAside
					dag={this.state.passiveDag!}
					currentTime={this.props.currentTime}
					nodeSelection={this.state.nodeSelectionPassiveDag}
          infoToggle={this.props.infoToggle}
          editToggle={this.props.editToggle}
					onUpdateNodeSelection={this.nodeSelectionChange.bind(this)}
					onLiteralOrientationChange={this.props.onLiteralOrientationChange}
					onLiteralRepresentationChange={this.props.onLiteralRepresentationChange}
					onSelectButtonPressed={this.selectButtonPressed.bind(this)}
          onToggleInfo={this.props.onToggleInfo}
          onToggleEdit={this.props.onToggleEdit}
				/>
			</ReactModal>
		)
	}	

	nodeSelectionChange(selection: number[]) {
		this.setState({nodeSelectionPassiveDag: selection});
	}

	updateNodePositions(nodeIds: number[], delta: [number, number]) {
		assert(this.state.passiveDag !== null);
    for (const nodeId of nodeIds) {
      const node = this.state.passiveDag!.get(nodeId);
      assert(node.position !== null);
      node.position = [node.position![0] + delta[0], node.position![1] + delta[1]];
    }
	}

	async generatePassiveDag() {
		// generate passive dag
		const passiveDag = passiveDagForSelection(this.props.dag, this.props.nodeSelection, this.props.currentTime);

		// layout node positions of passive dag
		await VizWrapper.layoutDag(passiveDag, false);

		// shift dag so that selected node occurs at same screen position as in currentDag
		const [posCurrentX, posCurrentY] = this.props.dag.get(this.props.nodeSelection[0]).getPosition();
		const [posPassiveX, posPassiveY] = passiveDag.get(this.props.nodeSelection[0]).getPosition();
		const deltaX = posCurrentX-posPassiveX;
		const deltaY = posCurrentY-posPassiveY;
		for (const node of passiveDag.nodes.values()) {
			assert(node.position != null);
			const position = node.position as [number, number];
			node.position = [position[0] + deltaX, position[1] + deltaY];
		}

		return passiveDag;
	}

	selectButtonPressed() {
		const passiveDag = this.state.passiveDag;
		assert(passiveDag !== null);
		assert(passiveDag!.isPassiveDag);
		assert(passiveDag!.activeNodeId !== null);
		
		assert(this.state.nodeSelectionPassiveDag.length === 1);
		const selectedId = this.state.nodeSelectionPassiveDag[0];
		assert(selectedId !== null);

		const styleMap = passiveDag!.styleMap!
		assert(styleMap !== null);
    assert(styleMap.get(selectedId) === "passive");
		
		// compute positioning hint
		const positioningHint = this.props.dag.get(this.state.passiveDag!.activeNodeId as number).position;
		assert(positioningHint !== null);

		this.props.onDismissPassiveDag(selectedId, positioningHint!);
	}

}
